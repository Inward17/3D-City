import React, { useState } from 'react';
import type { Project } from '../../../store/projectStore';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Eye, Edit2, Edit3, MoreVertical, Trash2, Calendar, Layers, Building, Briefcase } from 'lucide-react';

export interface ProjectCardProps {
    project: Project;
    isListView?: boolean;
    index?: number;
    isEditing: boolean;
    editingName: string;
    setEditingName: (val: string) => void;
    editInputRef: React.RefObject<HTMLInputElement>;
    handleEditStart: (project: Project) => void;
    handleEditSave: () => void;
    handleEditKeyDown: (e: React.KeyboardEvent) => void;
    isDropdownOpen: boolean;
    toggleDropdown: (id: string | null) => void;
    setDeleteConfirm: (id: string) => void;
}

export function ProjectCard({
    project,
    isListView = false,
    index = 0,
    isEditing,
    editingName,
    setEditingName,
    editInputRef,
    handleEditStart,
    handleEditSave,
    handleEditKeyDown,
    isDropdownOpen,
    toggleDropdown,
    setDeleteConfirm
}: ProjectCardProps) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className={`group relative rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:border-sky-300 hover:shadow-lg hover:shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-700/60 ${isListView ? 'flex items-center p-4' : 'p-5'
                } animate-fade-slide-in`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                animationDelay: `${index * 100}ms`,
                animationFillMode: 'both'
            }}
        >
            <div className={`${isListView ? 'flex items-center flex-1 gap-4' : ''}`}>
                {/* Project Icon */}
                <div className={`${isListView ? 'flex-shrink-0' : 'mb-4'}`}>
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 transition-colors group-hover:bg-sky-500/15 dark:text-sky-400">
                        {project.model_type === 'planning' ? (
                            <Building className="h-5 w-5" />
                        ) : (
                            <Briefcase className="h-5 w-5" />
                        )}
                    </div>
                </div>

                {/* Project Info */}
                <div className={`${isListView ? 'flex-1 min-w-0' : ''}`}>
                    <div className={`${isListView ? 'flex items-start justify-between' : ''}`}>
                        <div className={`${isListView ? 'min-w-0 flex-1' : ''}`}>
                            {/* Editable Title */}
                            {isEditing ? (
                                <input
                                    ref={editInputRef}
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onBlur={handleEditSave}
                                    onKeyDown={handleEditKeyDown}
                                    className={`w-full border-b-2 border-sky-500 bg-transparent font-semibold text-slate-900 focus:outline-none dark:text-white ${isListView ? 'mb-1 text-base' : 'mb-1.5 text-lg'
                                        }`}
                                />
                            ) : (
                                <h3
                                    className={`cursor-pointer font-semibold text-slate-900 transition-colors group-hover:text-sky-600 dark:text-white dark:group-hover:text-sky-400 ${isListView ? 'mb-1 truncate text-base' : 'mb-1.5 text-lg'
                                        }`}
                                    onDoubleClick={() => handleEditStart(project)}
                                    title="Double-click to edit"
                                >
                                    {project.name}
                                </h3>
                            )}

                            {/* Project Type Badge & Metadata */}
                            <div className={`${isListView ? 'flex items-center gap-3 mb-1' : 'mb-3'}`}>
                                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${project.model_type === 'planning'
                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-violet-500/10 text-violet-700 dark:text-violet-400'
                                    }`}>
                                    {project.model_type === 'planning' ? 'City Planning' : 'Corporate Campus'}
                                </span>

                                {/* Sectors indicator */}
                                {project.sectors && project.sectors.length > 0 && (
                                    <div className="flex items-center gap-1">
                                        <Layers className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {project.sectors.length} sector{project.sectors.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                )}

                                {isListView && (
                                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                        <Calendar className="h-4 w-4 mr-1" />
                                        {format(new Date(project.updated_at || project.created_at), 'MMM d, yyyy')}
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            {project.description && (
                                <p className={`text-gray-600 dark:text-gray-300 ${isListView ? 'text-sm truncate' : 'text-sm mb-4 line-clamp-2'
                                    }`}>
                                    {project.description}
                                </p>
                            )}

                            {/* Grid View Footer */}
                            {!isListView && (
                                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                                    <Calendar className="h-4 w-4 mr-1" />
                                    Last updated {format(new Date(project.updated_at || project.created_at), 'MMMM d, yyyy')}
                                </div>
                            )}
                        </div>

                        {/* Actions - Always visible on list view, hover on grid view */}
                        <div className={`${isListView
                                ? 'flex items-center gap-1 ml-4'
                                : `absolute top-4 right-4 flex items-center gap-1 transition-all duration-300 ${isHovered || isDropdownOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                                }`
                            }`}>
                            {/* Quick Actions */}
                            <div className="flex items-center gap-1">
                                <Link
                                    to={`/project/${project.id}`}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg backdrop-blur-sm bg-gray-50/80 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 hover:bg-blue-50/80 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 hover:scale-110"
                                    title="View Project"
                                >
                                    <Eye className="h-4 w-4" />
                                </Link>
                                <button
                                    onClick={() => handleEditStart(project)}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg backdrop-blur-sm bg-gray-50/80 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-600/80 transition-all duration-200 hover:scale-110"
                                    title="Edit Project Name"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                                <Link
                                    to={`/edit/${project.id}`}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg backdrop-blur-sm bg-gray-50/80 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-600/80 transition-all duration-200 hover:scale-110"
                                    title="Edit Project Settings"
                                >
                                    <Edit3 className="h-4 w-4" />
                                </Link>

                                {/* More Actions Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => toggleDropdown(isDropdownOpen ? null : project.id)}
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg backdrop-blur-sm bg-gray-50/80 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-600/80 transition-all duration-200 hover:scale-110"
                                        title="More actions"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </button>

                                    {isDropdownOpen && (
                                        <div className="absolute right-0 mt-2 w-48 backdrop-blur-md bg-white/90 dark:bg-gray-800/90 rounded-xl shadow-xl dark:shadow-gray-900/30 border border-gray-200/50 dark:border-gray-700/50 py-1 z-20 animate-scale-in">
                                            <button
                                                onClick={() => {
                                                    setDeleteConfirm(project.id);
                                                    toggleDropdown(null);
                                                }}
                                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-900/30 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4 mr-3" />
                                                Delete Project
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Grid View Primary Action */}
                    {!isListView && (
                        <div className="flex items-center justify-between">
                            <Link
                                to={`/project/${project.id}`}
                                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 backdrop-blur-sm"
                            >
                                <Eye className="h-4 w-4 mr-2" />
                                View Project
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
