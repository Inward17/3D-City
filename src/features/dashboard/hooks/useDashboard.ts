import { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../../../store/projectStore';
import type { Project } from '../../../store/projectStore';

export type SortOption = 'name' | 'date' | 'type';
export type ViewMode = 'grid' | 'list';
export type FilterType = 'all' | 'planning' | 'corporate';

export function useDashboard() {
  const { projects, loading, fetchProjects, deleteProject, updateProject } = useProjectStore();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (editingProject && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingProject]);

  const handleDelete = async (projectId: string) => {
    setDeleteLoading(true);
    setError('');
    try {
      await deleteProject(projectId);
      setSuccess('Project deleted successfully');
      setDeleteConfirm(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEditStart = (project: Project) => {
    setEditingProject(project.id);
    setEditingName(project.name);
  };

  const handleEditSave = async () => {
    if (!editingProject || !editingName.trim()) return;
    
    try {
      await updateProject(editingProject, {
        name: editingName.trim(),
        updated_at: new Date().toISOString()
      });
      setEditingProject(null);
      setEditingName('');
      setSuccess('Project name updated');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Failed to update project name');
    }
  };

  const handleEditCancel = () => {
    setEditingProject(null);
    setEditingName('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  // Filter and sort projects
  const filteredAndSortedProjects = projects
    .filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           project.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterType === 'all' || project.model_type === filterType;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return a.model_type.localeCompare(b.model_type);
        case 'date':
        default:
          return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
      }
    });

  return {
    loading,
    error,
    setError,
    success,
    setSuccess,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    filterType,
    setFilterType,
    viewMode,
    setViewMode,
    openDropdown,
    setOpenDropdown,
    editingProject,
    editingName,
    setEditingName,
    editInputRef,
    handleEditStart,
    handleEditSave,
    handleEditKeyDown,
    deleteConfirm,
    setDeleteConfirm,
    deleteLoading,
    handleDelete,
    filteredAndSortedProjects
  };
}
