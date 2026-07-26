import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../../../store/projectStore';
import { cityPlanningData } from '../../../data/cityPlanningData';
import { corporateCampusData } from '../../../data/corporateCampusData';
import { LOCAL_USER_ID } from '../../../lib/localRepo';

export const DEFAULT_MAP_VIEW = {
    center_lat: 18.5204, // Pune
    center_lng: 73.8567,
    zoom: 15
} as const;

export interface ProjectFormData {
    id?: string;
    name: string;
    description: string;
    model_type: 'planning' | 'corporate';
    sectors: string[];
    theme: string;
    // Optional: existing projects created before these columns existed have no
    // stored map view, and fall back to DEFAULT_MAP_VIEW.
    center_lat?: number;
    center_lng?: number;
    zoom?: number;
}

export function useProjectForm(mode: 'create' | 'edit', initialData?: ProjectFormData) {
    const navigate = useNavigate();
    const { createProject, updateProject } = useProjectStore();

    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        description: initialData?.description || '',
        model_type: initialData?.model_type || 'planning',
        sectors: initialData?.sectors || [],
        theme: initialData?.theme || 'default',
        center_lat: initialData?.center_lat ?? DEFAULT_MAP_VIEW.center_lat,
        center_lng: initialData?.center_lng ?? DEFAULT_MAP_VIEW.center_lng,
        zoom: initialData?.zoom ?? DEFAULT_MAP_VIEW.zoom
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showExitPrompt, setShowExitPrompt] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    useEffect(() => {
        if (mode === 'edit' && initialData) {
            // Compare against the same fallbacks used to seed the form, or a
            // project with no stored map view would look dirty on open.
            const hasChanges =
                formData.name !== initialData.name ||
                formData.description !== initialData.description ||
                formData.model_type !== initialData.model_type ||
                formData.theme !== initialData.theme ||
                formData.center_lat !== (initialData.center_lat ?? DEFAULT_MAP_VIEW.center_lat) ||
                formData.center_lng !== (initialData.center_lng ?? DEFAULT_MAP_VIEW.center_lng) ||
                formData.zoom !== (initialData.zoom ?? DEFAULT_MAP_VIEW.zoom) ||
                JSON.stringify(formData.sectors) !== JSON.stringify(initialData.sectors);

            setHasUnsavedChanges(hasChanges);
        }
    }, [formData, initialData, mode]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const previewData = useMemo(() => {
        const data = formData.model_type === 'planning' ? cityPlanningData : corporateCampusData;
        const selectedLocations = data.locations.filter(loc =>
            formData.sectors.includes(loc.zone || '')
        );

        return {
            buildingCount: selectedLocations.length,
            sectors: formData.sectors.length,
            primaryZone: formData.sectors[0]
        };
    }, [formData.model_type, formData.sectors]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (mode === 'create') {
                const projectId = await createProject({
                    ...formData,
                    user_id: LOCAL_USER_ID
                });
                navigate(`/project/${projectId}`);
            } else {
                await updateProject(initialData!.id!, {
                    ...formData,
                    updated_at: new Date().toISOString()
                });
                setHasUnsavedChanges(false);
                navigate('/');
            }
        } catch (err) {
            console.error('Project operation error:', err);
            console.error('Detailed Error:', JSON.stringify(err, null, 2));
            const errorMessage = err instanceof Error ? err.message :
                (typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : '') || 'Failed to save project. Ensure your Supabase table has the required center_lat and center_lng columns.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        if (hasUnsavedChanges) {
            setShowExitPrompt(true);
        } else {
            navigate('/');
        }
    };

    return {
        navigate,
        formData,
        setFormData,
        loading,
        error,
        showExitPrompt,
        setShowExitPrompt,
        hasUnsavedChanges,
        previewData,
        handleSubmit,
        handleCancel
    };
}
