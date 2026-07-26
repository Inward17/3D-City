import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useCityStore } from '../../store/cityStore';
import type { CameraPreset } from '../../store/cityStore';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';

interface CameraTransition {
  from: {
    position: THREE.Vector3;
    target: THREE.Vector3;
    fov: number;
  };
  to: {
    position: THREE.Vector3;
    target: THREE.Vector3;
    fov: number;
  };
  duration: number;
  easing: (t: number) => number;
  onComplete?: () => void;
}

// Advanced easing functions
const easingFunctions = {
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  easeInOutQuint: (t: number) => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
};

// Camera state manager
class CameraStateManager {
  private transitions: CameraTransition[] = [];
  private currentTransition: CameraTransition | null = null;
  private transitionStartTime: number = 0;
  private isTransitioning: boolean = false;

  addTransition(transition: CameraTransition) {
    this.transitions.push(transition);
  }

  update(camera: THREE.Camera, controls: OrbitControls) {
    if (!this.isTransitioning && this.transitions.length > 0) {
      this.startNextTransition(camera, controls);
    }

    if (this.isTransitioning && this.currentTransition) {
      this.updateCurrentTransition(camera, controls);
    }
  }

  private startNextTransition(camera: THREE.Camera, controls: OrbitControls) {
    this.currentTransition = this.transitions.shift()!;
    this.transitionStartTime = performance.now();
    this.isTransitioning = true;

    // Store current state as 'from'
    this.currentTransition.from = {
      position: camera.position.clone(),
      target: controls.target.clone(),
      fov: (camera as THREE.PerspectiveCamera).fov || 75
    };
  }

  private updateCurrentTransition(camera: THREE.Camera, controls: OrbitControls) {
    if (!this.currentTransition) return;

    const elapsed = performance.now() - this.transitionStartTime;
    const progress = Math.min(elapsed / (this.currentTransition.duration * 1000), 1);
    const easedProgress = this.currentTransition.easing(progress);

    // Interpolate position
    camera.position.lerpVectors(
      this.currentTransition.from.position,
      this.currentTransition.to.position,
      easedProgress
    );

    // Interpolate target
    controls.target.lerpVectors(
      this.currentTransition.from.target,
      this.currentTransition.to.target,
      easedProgress
    );

    // Interpolate FOV
    if ((camera as THREE.PerspectiveCamera).fov !== undefined) {
      (camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.lerp(
        this.currentTransition.from.fov,
        this.currentTransition.to.fov,
        easedProgress
      );
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }

    // Check if transition is complete
    if (progress >= 1) {
      this.isTransitioning = false;
      if (this.currentTransition.onComplete) {
        this.currentTransition.onComplete();
      }
      this.currentTransition = null;
    }
  }

  isCurrentlyTransitioning(): boolean {
    return this.isTransitioning;
  }

  clearTransitions() {
    this.transitions = [];
    this.isTransitioning = false;
    this.currentTransition = null;
  }
}

export function SmoothCameraControls() {
  const { camera, gl } = useThree();
  const {
    setCameraRefs,
    registerCameraController,
    setCameraTransitioning,
    isPlacingBuilding,
    isPlacingRoute
  } = useCityStore();

  // Created eagerly rather than in an effect: useFrame can fire before effects
  // flush, and the registered controller must be usable immediately.
  const stateManagerRef = useRef<CameraStateManager>(new CameraStateManager());

  // Create enhanced controls
  const controls = useMemo(() => {
    if (!camera || !gl.domElement) return null;

    const controls = new OrbitControls(camera, gl.domElement);

    // Enhanced control settings
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    // The scene's initial camera sits ~35 units out, inside the old minDistance
    // of 50, so OrbitControls shoved it back on the first frame. It also made
    // the walkthrough preset (distance ~10) unreachable.
    controls.minDistance = 8;
    controls.maxDistance = 1600;
    // Stop just short of horizontal so the camera can't drop under the ground.
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    // Smooth zoom
    controls.zoomSpeed = 0.5;
    controls.rotateSpeed = 0.5;
    controls.panSpeed = 0.8;

    // Enable auto-rotate for cinematic effect (can be toggled)
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.5;

    return controls;
  }, [camera, gl.domElement]);

  // Update placement restrictions dynamically
  useEffect(() => {
    if (controls) {
      const isPlacingAnything = isPlacingBuilding || isPlacingRoute;
      controls.enableRotate = !isPlacingAnything;

      // While placing, `enableRotate = false` above already neutralises the
      // left button, so left-click reaches the ground plane as a placement
      // click. (The old code set `LEFT: 0` intending to unbind it, but
      // THREE.MOUSE.ROTATE *is* 0, so it changed nothing.) Right-drag stays
      // mapped to pan so the user can still navigate mid-placement.
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      };
    }
  }, [controls, isPlacingBuilding, isPlacingRoute]);

  // Register controls with store
  useEffect(() => {
    if (camera && controls) {
      setCameraRefs(camera, controls);
    }
  }, [camera, controls, setCameraRefs]);

  // Enhanced preset animations
  const animateToPreset = useCallback((preset: CameraPreset) => {
    if (!stateManagerRef.current || !controls) return;

    const presets: Record<CameraPreset, { position: THREE.Vector3, target: THREE.Vector3, fov: number }> = {
      // Distances are in the same units as the city data, which spans roughly
      // ±250. The old presets were built for a ~30-unit scene and left the
      // camera buried inside the first city block.
      isometric: {
        position: new THREE.Vector3(320, 300, 320),
        target: new THREE.Vector3(0, 0, 0),
        fov: 45
      },
      aerial: {
        position: new THREE.Vector3(0, 620, 1),
        target: new THREE.Vector3(0, 0, 0),
        fov: 55
      },
      walkthrough: {
        position: new THREE.Vector3(60, 12, 90),
        target: new THREE.Vector3(0, 12, 0),
        fov: 70
      },
      cinematic: {
        position: new THREE.Vector3(420, 130, 420),
        target: new THREE.Vector3(0, 30, 0),
        fov: 38
      },
      free: {
        position: new THREE.Vector3(260, 200, 260),
        target: new THREE.Vector3(0, 0, 0),
        fov: 55
      }
    };

    const targetPreset = presets[preset];
    if (!targetPreset) return;

    const transition: CameraTransition = {
      from: {
        position: camera.position.clone(),
        target: controls.target.clone(),
        fov: (camera as THREE.PerspectiveCamera).fov || 75
      },
      to: targetPreset,
      duration: 2.5, // Longer, smoother transitions
      easing: easingFunctions.easeInOutCubic,
      onComplete: () => {
        // Enable auto-rotate for cinematic mode
        if (preset === 'cinematic') {
          controls.autoRotate = true;
        } else {
          controls.autoRotate = false;
        }
      }
    };

    stateManagerRef.current.addTransition(transition);
  }, [camera, controls]);

  // Smooth fly-to-location
  const flyToLocation = useCallback((position: [number, number, number], offset: [number, number, number] = [10, 10, 10]) => {
    if (!stateManagerRef.current || !controls) return;

    const targetPosition = new THREE.Vector3(
      position[0] + offset[0],
      position[1] + offset[1],
      position[2] + offset[2]
    );
    const targetTarget = new THREE.Vector3(...position);

    const transition: CameraTransition = {
      from: {
        position: camera.position.clone(),
        target: controls.target.clone(),
        fov: (camera as THREE.PerspectiveCamera).fov || 75
      },
      to: {
        position: targetPosition,
        target: targetTarget,
        fov: 60
      },
      duration: 1.8,
      easing: easingFunctions.easeOutQuart
    };

    stateManagerRef.current.addTransition(transition);
  }, [camera, controls]);

  useFrame(() => {
    if (controls) {
      controls.update();
      stateManagerRef.current.update(camera, controls);
      // setCameraTransitioning bails out when the value is unchanged, so this is
      // a no-op on all but the two frames where a transition starts or ends.
      setCameraTransitioning(stateManagerRef.current.isCurrentlyTransitioning());
    }
  });

  // Hand the rig to the store so UI components can drive the camera without
  // reaching for a global. Re-registers whenever the callbacks are rebuilt
  // (i.e. when the OrbitControls instance changes) to avoid a stale closure.
  useEffect(() => {
    registerCameraController({ animateToPreset, flyToLocation });
    return () => registerCameraController(null);
  }, [registerCameraController, animateToPreset, flyToLocation]);

  return null; // This component doesn't render anything
}