import { Line, QuadraticBezierLine, Circle } from '@react-three/drei';
import { useCityStore } from '../store/cityStore';
import { Vector3, CatmullRomCurve3, BufferGeometry, LineBasicMaterial, Line as ThreeLine } from 'three';
import { useMemo } from 'react';

export function Roads() {
  const { locations, roads, weather } = useCityStore();

  // Enhanced terrain calculation with more natural variations
  const calculateElevation = (x: number, z: number) => {
    const scale = 0.1;
    return (
      Math.sin(x * scale) * Math.cos(z * scale) * 0.8 + // Base terrain
      Math.sin(x * 0.3 + z * 0.2) * 0.4 + // Hills
      Math.cos(x * 0.2 - z * 0.15) * 0.3 + // Diagonal ridges
      Math.sin((x + z) * 0.15) * 0.2 // Additional variation
    );
  };

  // Generate control points for spline-based roads
  const generateSplinePoints = (
    start: [number, number, number],
    end: [number, number, number],
    type: 'main' | 'secondary' | 'residential',
    isRoundabout: boolean
  ) => {
    const points: Vector3[] = [];
    const segments = type === 'main' ? 12 : type === 'secondary' ? 8 : 6;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = start[0] + (end[0] - start[0]) * t;
      const currentZ = start[2] + (end[2] - start[2]) * t;
      
      // Keep roads flat with slight elevation
      let y = 0.1; // Slight elevation above terrain
      
      // Add natural variation for non-main roads
      const variation = type === 'residential' ? 0.2 : type === 'secondary' ? 0.1 : 0;
      const offsetX = (Math.random() - 0.5) * variation;
      const offsetZ = (Math.random() - 0.5) * variation;
      
      // Calculate midpoint influence for more natural curves
      const midpointInfluence = Math.sin(t * Math.PI) * (type === 'residential' ? 0.8 : 0.4);
      
      // Adjust for roundabout approaches
      if (isRoundabout && (i === 0 || i === segments)) {
        const roundaboutInfluence = i === 0 ? 0.8 : 0.8;
        points.push(new Vector3(
          x + offsetX * roundaboutInfluence,
          y,
          currentZ + offsetZ * roundaboutInfluence
        ));
      } else {
        // Add perpendicular offset for more natural curves
        const dx = end[0] - start[0];
        const dz = end[2] - start[2];
        const length = Math.sqrt(dx * dx + dz * dz);
        const perpX = -dz / length * midpointInfluence;
        const perpZ = dx / length * midpointInfluence;
        
        points.push(new Vector3(
          x + offsetX + perpX,
          y,
          currentZ + offsetZ + perpZ
        ));
      }
    }
    
    return points;
  };

  // Enhanced roundabout with proper road connections
  const Roundabout = ({ position, size = 2.5, connections }) => {
    const segments = 32;
    const circlePoints = useMemo(() => {
      const points = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new Vector3(
          Math.cos(angle) * size,
          0.15, // Slight elevation
          Math.sin(angle) * size
        ));
      }
      return points;
    }, [size]);

    return (
      <group position={[position[0], position[1], position[2]]}>
        {/* Main roundabout circle with shadow */}
        <Circle args={[size]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <meshStandardMaterial 
            color="#1e293b"
            roughness={0.6}
            metalness={0.4}
            envMapIntensity={1}
          />
        </Circle>
        
        {/* Inner traffic circle */}
        <Circle args={[size - 0.8]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <meshStandardMaterial 
            color="#475569"
            roughness={0.7}
            metalness={0.3}
          />
        </Circle>
        
        {/* Center island with landscaping */}
        <group position={[0, 0.07, 0]}>
          <Circle args={[size - 1.6]} rotation={[-Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color="#4ade80" />
          </Circle>
          {/* Decorative elements */}
          <Circle args={[size - 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color="#22c55e" />
          </Circle>
        </group>
        
        {/* Lane markings */}
        <primitive object={new ThreeLine(
          new BufferGeometry().setFromPoints(circlePoints),
          new LineBasicMaterial({ 
            color: '#ffffff',
            linewidth: 2
          })
        )} />
      </group>
    );
  };

  // Determine road surface properties based on weather
  const getRoadSurfaceProps = (roadType: 'main' | 'secondary' | 'residential') => {
    // Base colors for different road types
    const baseColors = {
      main: '#0f172a',
      secondary: '#334155',
      residential: '#64748b'
    };
    
    // Adjust for weather conditions
    if (weather === 'rain') {
      return {
        color: baseColors[roadType],
        roughness: 0.3, // Wet roads are less rough
        metalness: 0.6, // Wet roads are more reflective
        emissive: '#000000',
        emissiveIntensity: 0
      };
    } else if (weather === 'snow') {
      // Lighter color for snow-covered roads
      return {
        color: roadType === 'main' ? '#334155' : '#64748b',
        roughness: 0.8, // Snow is rough
        metalness: 0.1, // Snow is not reflective
        emissive: '#ffffff',
        emissiveIntensity: 0.05
      };
    } else {
      // Default dry road
      return {
        color: baseColors[roadType],
        roughness: 0.7,
        metalness: 0.2,
        emissive: '#000000',
        emissiveIntensity: 0
      };
    }
  };

  return (
    <>
      {/* Road base layer with enhanced materials */}
      {roads.map((road) => {
        const fromLocation = locations.find(loc => loc.id === road.from);
        const toLocation = locations.find(loc => loc.id === road.to);

        if (!fromLocation || !toLocation) return null;

        const intersectionType = road.type === 'main' ? 'roundabout' : 'basic';
        const hasComplexIntersection = intersectionType === 'roundabout';
        
        const splinePoints = generateSplinePoints(
          fromLocation.position,
          toLocation.position,
          road.type,
          hasComplexIntersection
        );

        const curve = new CatmullRomCurve3(splinePoints);
        const curvePoints = curve.getPoints(50);

        // Road width based on type
        const width = road.type === 'main' ? 2.5 : 
                     road.type === 'secondary' ? 2 : 1.5;
                     
        // Get road surface properties based on weather
        const surfaceProps = getRoadSurfaceProps(road.type);

        return (
          <group key={`road-${road.id}`}>
            {/* Road surface with enhanced material */}
            <Line
              points={curvePoints}
              color={surfaceProps.color}
              lineWidth={width}
              position={[0, 0.05, 0]}
            />
            
            {/* Road markings */}
            {road.type === 'main' && (
              <>
                {/* Center line */}
                <Line
                  points={curvePoints}
                  color="#ffffff"
                  lineWidth={0.2}
                  dashed
                  dashScale={10}
                  dashSize={2}
                  gapSize={1}
                  position={[0, 0.06, 0]}
                />
                
                {/* Edge lines */}
                <Line
                  points={curvePoints}
                  color="#ffffff"
                  lineWidth={0.1}
                  position={[0, 0.06, 0]}
                />
              </>
            )}
            
            {road.type === 'secondary' && (
              <Line
                points={curvePoints}
                color="#ffffff"
                lineWidth={0.1}
                dashed
                dashScale={8}
                dashSize={1}
                gapSize={2}
                position={[0, 0.06, 0]}
              />
            )}
            
            {/* Road shadows for better contrast */}
            <Line
              points={curvePoints}
              color="#000000"
              lineWidth={width + 0.3}
              transparent
              opacity={0.3}
              position={[0, 0.04, 0]}
            />
          </group>
        );
      })}

      {/* Roundabouts */}
      {locations.map((location) => {
        const connectedMainRoads = roads.filter(
          road => (road.from === location.id || road.to === location.id) && road.type === 'main'
        );
        
        if (connectedMainRoads.length >= 2) {
          return (
            <Roundabout
              key={`roundabout-${location.id}`}
              position={location.position}
              size={3}
              connections={connectedMainRoads}
            />
          );
        }
        return null;
      })}
    </>
  );
}