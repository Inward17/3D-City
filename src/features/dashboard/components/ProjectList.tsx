import React from 'react';
import type { Project } from '../../../store/projectStore';
import { ProjectCard } from './ProjectCard';
import { ViewMode } from '../hooks/useDashboard';
import { Map, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProjectListProps {
    projects: Project[];
    viewMode: ViewMode;
    searchTerm: string;
    filterType: string;
    isEditing: string | null;
    editingName: string;
    setEditingName: (val: string) => void;
    editInputRef: React.RefObject<HTMLInputElement>;
    handleEditStart: (project: Project) => void;
    handleEditSave: () => void;
    handleEditKeyDown: (e: React.KeyboardEvent) => void;
    openDropdown: string | null;
    setOpenDropdown: (id: string | null) => void;
    setDeleteConfirm: (id: string) => void;
}

export function ProjectList({
    projects,
    viewMode,
    searchTerm,
    filterType,
    isEditing,
    editingName,
    setEditingName,
    editInputRef,
    handleEditStart,
    handleEditSave,
    handleEditKeyDown,
    openDropdown,
    setOpenDropdown,
    setDeleteConfirm,
}: ProjectListProps) {
    if (projects.length === 0) {
        return (
            <div className="backdrop-blur-md bg-white/80 dark:bg-gray-800/80 rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-16 text-center shadow-lg animate-fade-in">
                <div className="relative w-32 h-32 mx-auto mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-full"></div>
                    <div className="absolute inset-4 bg-gradient-to-br from-blue-200 to-indigo-200 dark:from-blue-800/50 dark:to-indigo-800/50 rounded-full"></div>
                    <div className="absolute inset-8 bg-gradient-to-br from-blue-300 to-indigo-300 dark:from-blue-700/70 dark:to-indigo-700/70 rounded-full flex items-center justify-center">
                        <Map className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                    </div>
                </div>

                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                    {searchTerm || filterType !== 'all' ? 'No projects found' : 'You haven\'t created any projects yet'}
                </h3>
                <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">
                    {searchTerm || filterType !== 'all'
                        ? 'Try adjusting your search criteria or filters to find what you\'re looking for'
                        : 'Start your urban planning journey by creating your first project. Design cities, manage corporate campuses, and bring your vision to life.'
                    }
                </p>
                {!searchTerm && filterType === 'all' && (
                    <Link
                        to="/create"
                        className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 backdrop-blur-sm"
                    >
                        <Plus className="h-5 w-5 mr-2" />
                        Create Your First Project
                    </Link>
                )}
            </div>
        );
    }

    return (
        <div className={`${viewMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
            }`}>
            {projects.map((project, index) => (
                <ProjectCard
                    key={project.id}
                    project={project}
                    isListView={viewMode === 'list'}
                    index={index}
                    isEditing={isEditing === project.id}
                    editingName={editingName}
                    setEditingName={setEditingName}
                    editInputRef={editInputRef}
                    handleEditStart={handleEditStart}
                    handleEditSave={handleEditSave}
                    handleEditKeyDown={handleEditKeyDown}
                    isDropdownOpen={openDropdown === project.id}
                    toggleDropdown={setOpenDropdown}
                    setDeleteConfirm={setDeleteConfirm}
                />
            ))}
        </div>
    );
}
