import { Link } from 'react-router-dom';
import { Plus, Loader2, Trash2, X, Filter, Search, Grid, List } from 'lucide-react';
import { DarkModeToggle } from '../../components/DarkModeToggle';
import { useDashboard, SortOption, FilterType } from './hooks/useDashboard';
import { ProjectList } from './components/ProjectList';

export function Dashboard() {
    const dashboardState = useDashboard();
    const {
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
    } = dashboardState;

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Loading projects…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen bg-slate-100 dark:bg-slate-950">
            {/* Click outside to close dropdown */}
            {openDropdown && (
                <div
                    className="fixed inset-0 z-10"
                    onClick={() => setOpenDropdown(null)}
                />
            )}

            {/* Floating Action Button */}
            <Link
                to="/create"
                className="group fixed bottom-6 right-6 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg shadow-sky-600/25 transition-all duration-200 hover:bg-sky-500 sm:hidden"
                title="Create New Project"
            >
                <Plus className="h-6 w-6 transition-transform duration-200 group-hover:rotate-90" />
            </Link>

            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-7 flex flex-col sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Projects</h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage and organise your city planning projects</p>
                    </div>

                    <div className="mt-4 sm:mt-0 flex items-center gap-3">
                        <DarkModeToggle />
                        <Link
                            to="/create"
                            className="btn-primary hidden sm:inline-flex"
                        >
                            <Plus className="h-4 w-4" />
                            New Project
                        </Link>
                    </div>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="animate-slide-down mb-5 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                        <span>{error}</span>
                        <button onClick={() => setError('')} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                )}

                {success && (
                    <div className="animate-slide-down mb-5 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <span>{success}</span>
                        <button onClick={() => setSuccess('')} className="text-green-500 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                )}

                {/* Filters and Controls */}
                <div className="mb-6 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        {/* Search */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Filter */}
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-slate-400" />
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value as FilterType)}
                                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                    <option value="all">All Types</option>
                                    <option value="planning">City Planning</option>
                                    <option value="corporate">Corporate Campus</option>
                                </select>
                            </div>

                            {/* Sort */}
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortOption)}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                <option value="date">Last Edited</option>
                                <option value="name">A–Z</option>
                                <option value="type">Type</option>
                            </select>

                            {/* View Mode Toggle */}
                            <div className="segment">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`segment-item !px-2 ${viewMode === 'grid' ? 'segment-item-active' : ''}`}
                                    title="Grid view"
                                >
                                    <Grid className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`segment-item !px-2 ${viewMode === 'list' ? 'segment-item-active' : ''}`}
                                    title="List view"
                                >
                                    <List className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Projects Grid/List */}
                <ProjectList
                    projects={filteredAndSortedProjects}
                    viewMode={viewMode}
                    searchTerm={searchTerm}
                    filterType={filterType}
                    isEditing={editingProject}
                    editingName={editingName}
                    setEditingName={setEditingName}
                    editInputRef={editInputRef}
                    handleEditStart={handleEditStart}
                    handleEditSave={handleEditSave}
                    handleEditKeyDown={handleEditKeyDown}
                    openDropdown={openDropdown}
                    setOpenDropdown={setOpenDropdown}
                    setDeleteConfirm={setDeleteConfirm}
                />

                {/* Delete Confirmation Modal */}
                {deleteConfirm && (
                    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                        <div className="animate-scale-in w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-center mb-4">
                                <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/60">
                                    <Trash2 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                </div>
                                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Delete project</h3>
                            </div>
                            <p className="mb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                Are you sure you want to delete this project? This action cannot be undone and all project data will be permanently removed.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="btn-ghost"
                                    disabled={deleteLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDelete(deleteConfirm)}
                                    className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-60"
                                    disabled={deleteLoading}
                                >
                                    {deleteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Delete Project
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes fade-slide-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-slide-in { animation: fade-slide-in 0.6s ease-out; }
        .animate-slide-down { animation: slide-down 0.3s ease-out; }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
        </div>
    );
}
