import { useState, useEffect } from 'react';
import { MessageCircle, Plus, X, Edit3, Trash2, User, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface Comment {
  id: string;
  locationId: string;
  author: string;
  content: string;
  timestamp: Date;
  type: 'note' | 'issue' | 'suggestion';
}

/** Shape as persisted to localStorage: Date is serialised to an ISO string. */
type StoredComment = Omit<Comment, 'timestamp'> & { timestamp: string };

interface LocationCommentsProps {
  locationId: string;
  locationName: string;
  onClose: () => void;
}

const commentTypes = [
  { value: 'note', label: 'Note', color: 'blue' },
  { value: 'issue', label: 'Issue', color: 'red' },
  { value: 'suggestion', label: 'Suggestion', color: 'green' }
];

export function LocationComments({ locationId, locationName, onClose }: LocationCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newCommentType, setNewCommentType] = useState<Comment['type']>('note');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Load comments from localStorage (in a real app, this would be from a database)
  useEffect(() => {
    const savedComments = localStorage.getItem(`comments-${locationId}`);
    if (savedComments) {
      const parsed = JSON.parse(savedComments);
      setComments(parsed.map((c: StoredComment) => ({ ...c, timestamp: new Date(c.timestamp) })));
    }
  }, [locationId]);

  // Save comments to localStorage
  const saveComments = (updatedComments: Comment[]) => {
    localStorage.setItem(`comments-${locationId}`, JSON.stringify(updatedComments));
    setComments(updatedComments);
  };

  const addComment = () => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      locationId,
      author: 'Current User', // In a real app, get from auth
      content: newComment.trim(),
      timestamp: new Date(),
      type: newCommentType
    };

    const updatedComments = [...comments, comment];
    saveComments(updatedComments);
    setNewComment('');
  };

  const deleteComment = (commentId: string) => {
    const updatedComments = comments.filter(c => c.id !== commentId);
    saveComments(updatedComments);
  };

  const startEdit = (comment: Comment) => {
    setEditingComment(comment.id);
    setEditContent(comment.content);
  };

  const saveEdit = () => {
    if (!editContent.trim() || !editingComment) return;

    const updatedComments = comments.map(c => 
      c.id === editingComment 
        ? { ...c, content: editContent.trim() }
        : c
    );
    saveComments(updatedComments);
    setEditingComment(null);
    setEditContent('');
  };

  const cancelEdit = () => {
    setEditingComment(null);
    setEditContent('');
  };

  const getTypeColor = (type: Comment['type']) => {
    switch (type) {
      case 'issue': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
      case 'suggestion': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
      default: return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6 text-blue-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Comments</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{locationName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {comments.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No comments yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">Add the first comment below</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {comment.author}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(comment.type)}`}>
                      {commentTypes.find(t => t.value === comment.type)?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(comment)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="Edit comment"
                    >
                      <Edit3 className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                    </button>
                    <button
                      onClick={() => deleteComment(comment.id)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      title="Delete comment"
                    >
                      <Trash2 className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                    </button>
                  </div>
                </div>
                
                {editingComment === comment.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">{comment.content}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="h-3 w-3" />
                      {format(comment.timestamp, 'MMM d, yyyy \'at\' h:mm a')}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add Comment Form */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-3">
            <div className="flex gap-2">
              {commentTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setNewCommentType(type.value as Comment['type'])}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    newCommentType === type.value
                      ? getTypeColor(type.value as Comment['type'])
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
              <button
                onClick={addComment}
                disabled={!newComment.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}