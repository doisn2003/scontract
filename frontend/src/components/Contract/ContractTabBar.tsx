import { useState } from 'react';
import { 
  HiOutlinePlus, 
  HiOutlinePencil,
  HiOutlineCheck,
  HiOutlineTrash
} from 'react-icons/hi2';
import './ContractTabBar.css';

interface ContractTabBarProps {
  contracts: { _id: string; name: string }[];
  activeId: string;
  onTabChange: (id: string) => void;
  onAddContract: () => void;
  onRemoveContract: (id: string) => void;
  onRenameContract: (id: string, newName: string) => void;
  onReorderContracts: (ids: string[]) => void;
  isOwner: boolean;
}

export default function ContractTabBar({
  contracts,
  activeId,
  onTabChange,
  onAddContract,
  onRemoveContract,
  onRenameContract,
  onReorderContracts,
  isOwner
}: ContractTabBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleStartRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditName(currentName);
  };

  const handleSaveRename = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (editName.trim() && editName !== contracts.find(c => c._id === id)?.name) {
      onRenameContract(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this contract? This action cannot be undone.')) {
      onRemoveContract(id);
    }
  };

  // ─── Drag & Drop Handlers ───
  const handleDragStart = (index: number) => {
    if (!isOwner) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Required to allow drop
    if (!isOwner) return;
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (index: number) => {
    if (!isOwner || draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      return;
    }

    const newContracts = [...contracts];
    const [movedItem] = newContracts.splice(draggedIndex, 1);
    newContracts.splice(index, 0, movedItem);

    onReorderContracts(newContracts.map(c => c._id));
    setDraggedIndex(null);
  };

  return (
    <div className="contract-tab-bar">
      <div className="tabs-container">
        {contracts.map((contract, index) => (
          <div
            key={contract._id}
            draggable={isOwner && editingId !== contract._id}
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(index)}
            className={`contract-tab ${activeId === contract._id ? 'active' : ''} ${draggedIndex === index ? 'dragging' : ''}`}
            onClick={() => onTabChange(contract._id)}
          >
            {editingId === contract._id ? (
              <form className="rename-form" onSubmit={(e) => handleSaveRename(contract._id, e)}>
                <input
                  autoFocus
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => setEditingId(null)}
                  onClick={(e) => e.stopPropagation()}
                />
                <button type="button" onMouseDown={(e) => handleSaveRename(contract._id, e as any)}>
                  <HiOutlineCheck />
                </button>
              </form>
            ) : (
              <>
                <span className="tab-name">{contract.name}</span>
                {isOwner && activeId === contract._id && (
                  <div className="tab-actions">
                    <button className="rename-btn" onClick={(e) => handleStartRename(contract._id, contract.name, e)}>
                      <HiOutlinePencil size={12} />
                    </button>
                    {contracts.length > 1 && (
                      <button className="remove-btn" onClick={(e) => handleRemove(contract._id, e)}>
                        <HiOutlineTrash size={12} />
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {isOwner && (
          <button className="add-tab-btn" onClick={onAddContract} title="Add new contract">
            <HiOutlinePlus />
          </button>
        )}
      </div>
    </div>
  );
}
