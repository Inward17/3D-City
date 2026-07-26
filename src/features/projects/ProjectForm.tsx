
import { PlusCircle, Save, ArrowLeft, Building, Briefcase, Check, AlertTriangle } from 'lucide-react';
import { SectorSelector } from './components/SectorSelector';
import { ThemeSelector } from './components/ThemeSelector';
import { LocationPicker } from './components/LocationPicker';
import { useProjectForm, ProjectFormData } from './hooks/useProjectForm';
import { DarkModeToggle } from '../../components/DarkModeToggle';

interface ProjectFormProps {
    mode: 'create' | 'edit';
    initialData?: ProjectFormData;
}

export function ProjectForm({ mode, initialData }: ProjectFormProps) {
    const {
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
    } = useProjectForm(mode, initialData);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 transition-colors">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            {mode === 'create' ? 'Create New Project' : 'Edit Project'}
                        </h1>
                        {hasUnsavedChanges && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                                <AlertTriangle className="w-4 h-4 mr-1" />
                                Unsaved changes
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <DarkModeToggle />
                        <button
                            // Sits inside the form, so without this it defaults
                            // to submit and saves the project on the way out.
                            type="button"
                            onClick={handleCancel}
                            className="btn-ghost"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to projects
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-3 gap-6">
                    <div className="col-span-2">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/20 p-6 border border-gray-200 dark:border-gray-700">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Project Name
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:focus:border-blue-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Description
                                    </label>
                                    <textarea
                                        id="description"
                                        rows={4}
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Project Type</label>
                                    <div className="mt-2 grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({
                                                ...prev,
                                                model_type: 'planning',
                                                sectors: []
                                            }))}
                                            className={`flex items-center justify-center p-4 border-2 rounded-lg transition-colors ${formData.model_type === 'planning'
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                                                }`}
                                        >
                                            <Building className="h-6 w-6 mr-2 text-gray-700 dark:text-gray-300" />
                                            <span className="font-medium text-gray-900 dark:text-white">City Planning</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({
                                                ...prev,
                                                model_type: 'corporate',
                                                sectors: []
                                            }))}
                                            className={`flex items-center justify-center p-4 border-2 rounded-lg transition-colors ${formData.model_type === 'corporate'
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700'
                                                }`}
                                        >
                                            <Briefcase className="h-6 w-6 mr-2 text-gray-700 dark:text-gray-300" />
                                            <span className="font-medium text-gray-900 dark:text-white">Corporate Campus</span>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Active Sectors
                                    </label>
                                    <SectorSelector
                                        modelType={formData.model_type}
                                        selectedSectors={formData.sectors}
                                        onChange={(sectors) => setFormData(prev => ({ ...prev, sectors }))}
                                        showDescription
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Project Location
                                    </label>
                                    <LocationPicker
                                        lat={formData.center_lat}
                                        lng={formData.center_lng}
                                        zoom={formData.zoom}
                                        onChange={(lat, lng, zoom) => setFormData(prev => ({
                                            ...prev, center_lat: lat, center_lng: lng, zoom: zoom
                                        }))}
                                    />
                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                        Drag the map and drop the pin to set the center of your new urban project.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Theme
                                    </label>
                                    <ThemeSelector
                                        selectedTheme={formData.theme}
                                        onThemeChange={(themeId) => setFormData(prev => ({ ...prev, theme: themeId }))}
                                    />
                                </div>

                                <div className="flex justify-end space-x-4">
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || (mode === 'edit' && !hasUnsavedChanges)}
                                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 border border-transparent rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                                    >
                                        {mode === 'create' ? (
                                            <PlusCircle className="w-5 h-5 mr-2" />
                                        ) : (
                                            <Save className="w-5 h-5 mr-2" />
                                        )}
                                        {mode === 'create' ? 'Create Project' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/20 p-6 border border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Project Summary</h2>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">Selected Buildings</div>
                                    <div className="text-2xl font-semibold text-gray-900 dark:text-white">{previewData.buildingCount}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">Active Sectors</div>
                                    <div className="text-2xl font-semibold text-gray-900 dark:text-white">{previewData.sectors}</div>
                                </div>
                                {previewData.primaryZone && (
                                    <div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">Primary Zone</div>
                                        <div className="text-lg font-medium text-gray-900 dark:text-white capitalize">
                                            {previewData.primaryZone}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/20 p-6 border border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Requirements</h2>
                            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                                <li className="flex items-center">
                                    <Check className={`h-5 w-5 mr-2 ${formData.name ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />
                                    Project name
                                </li>
                                <li className="flex items-center">
                                    <Check className={`h-5 w-5 mr-2 ${formData.sectors.length > 0 ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />
                                    At least one sector selected
                                </li>
                                <li className="flex items-center">
                                    <Check className={`h-5 w-5 mr-2 ${formData.theme ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />
                                    Theme selected
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Exit Confirmation Modal */}
            {showExitPrompt && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Discard Changes?</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
                        </p>
                        <div className="flex justify-end gap-4">
                            <button
                                onClick={() => setShowExitPrompt(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                                Stay
                            </button>
                            <button
                                onClick={() => navigate('/')}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 dark:bg-red-700 rounded-md hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
                            >
                                Discard & Leave
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
