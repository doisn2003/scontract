import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HiOutlineUsers,
  HiOutlineCommandLine,
  HiOutlineShieldCheck,
  HiOutlineXMark,
  HiOutlineExclamationTriangle
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import api from '../../services/api';
import type { Project } from '../../types';
import type { ParsedFunction } from '../../utils/abiParser';
import { parseABI } from '../../utils/abiParser';
import './ConfigSidebar.css';

interface ConfigSidebarProps {
  projectId: string;
  project: Project;
  contractAddress: string;
  parsedAbi: ReturnType<typeof parseABI> | null;
  currentFunctions: ParsedFunction[];
  onProjectUpdate: (project: Project) => void;
  onClose: () => void;
}

export default function ConfigSidebar({
  projectId,
  project,
  contractAddress,
  parsedAbi,
  currentFunctions,
  onProjectUpdate,
  onClose
}: ConfigSidebarProps) {
  const { t } = useTranslation();

  const [savingPerm, setSavingPerm] = useState<string | null>(null);
  const [configTab, setConfigTab] = useState<'global' | 'notes'>('global');
  const [guestInviteEmail, setGuestInviteEmail] = useState('');
  const [devInviteEmail, setDevInviteEmail] = useState('');
  const [revokeConfirm, setRevokeConfirm] = useState<{ type: 'guests' | 'devs' } | null>(null);

  const globalConfig = project?.global_access_config || {
    invited_guests: [], allow_all_guests: false, allow_all_devs: false, allow_read: false, allow_write: false, allow_payable: false
  };

  const getPermission = (fnName: string) => {
    return project?.guest_permissions?.find(p => p.contractAddress === contractAddress && p.methodName === fnName);
  };

  const isOverriddenByGlobal = (fn: ParsedFunction) => {
    if (fn.type === 'read' && globalConfig.allow_read) return true;
    if (fn.stateMutability === 'payable' && globalConfig.allow_payable) return true;
    if (fn.type !== 'read' && fn.stateMutability !== 'payable' && globalConfig.allow_write) return true;
    return false;
  };

  const handleUpdateGlobalConfig = async (updates: Partial<typeof globalConfig>, extraPatch?: Record<string, any>) => {
    if (!projectId || !project) return;
    const newConfig = { ...globalConfig, ...updates };
    try {
      const res = await api.patch(`/projects/${projectId}`, { global_access_config: newConfig, ...extraPatch });
      if (res.data?.success) onProjectUpdate(res.data.data);
    } catch {
      toast.error('Failed to update config');
    }
  };

  const handleToggleAllowAllGuests = (checked: boolean) => {
    if (checked) {
      handleUpdateGlobalConfig({ allow_all_guests: true });
    } else {
      setRevokeConfirm({ type: 'guests' });
    }
  };

  const handleToggleAllowAllDevs = (checked: boolean) => {
    if (checked) {
      handleUpdateGlobalConfig({ allow_all_devs: true });
    } else {
      setRevokeConfirm({ type: 'devs' });
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokeConfirm || !projectId) return;
    if (revokeConfirm.type === 'guests') {
      await handleUpdateGlobalConfig(
        { allow_all_guests: false, invited_guests: [] }
      );
      toast.success(t('pages.interact.config.all_revoked_guests'));
    } else {
      await handleUpdateGlobalConfig(
        { allow_all_devs: false },
        { clear_shared_devs: true }
      );
      toast.success(t('pages.interact.config.all_revoked_devs'));
    }
    setRevokeConfirm(null);
  };

  const handleRemoveGuest = async (email: string) => {
    if (!projectId) return;
    try {
      const res = await api.patch(`/projects/${projectId}`, { remove_invited_guest: email });
      if (res.data?.success) {
        onProjectUpdate(res.data.data);
        toast.success(`Removed ${email}`);
      }
    } catch {
      toast.error('Failed to remove guest');
    }
  };

  const handleRemoveDev = async (devId: string) => {
    if (!projectId) return;
    try {
      const res = await api.patch(`/projects/${projectId}`, { remove_shared_dev_id: devId });
      if (res.data?.success) {
        onProjectUpdate(res.data.data);
        toast.success('Developer removed');
      }
    } catch {
      toast.error('Failed to remove developer');
    }
  };

  const handleInviteDev = async () => {
    if (!projectId || !devInviteEmail) return;
    try {
      const res = await api.patch(`/projects/${projectId}`, { add_shared_dev_email: devInviteEmail });
      if (res.data?.success) {
        onProjectUpdate(res.data.data);
        setDevInviteEmail('');
        toast.success('Developer invited');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to invite developer');
    }
  };

  const handleInviteGuest = () => {
    if (!guestInviteEmail) return;
    const currentList = globalConfig.invited_guests || [];
    if (!currentList.includes(guestInviteEmail)) {
      handleUpdateGlobalConfig({ invited_guests: [...currentList, guestInviteEmail] });
      setGuestInviteEmail('');
      toast.success('Guest invited');
    }
  };

  const handleUpdatePermission = async (fnName: string, isGlobalAllowed: boolean, guestEmails: string, noteStr?: string) => {
    if (!projectId || !project || !contractAddress) return;
    setSavingPerm(fnName);
    try {
      const allowedGuestList = guestEmails.split(',').map(e => e.trim()).filter(e => e);
      let newPerms = project.guest_permissions ? [...project.guest_permissions] : [];
      const index = newPerms.findIndex(p => p.contractAddress === contractAddress && p.methodName === fnName);

      const updatedPerm = {
        contractAddress,
        methodName: fnName,
        isGlobalAllowed,
        allowedGuestList,
        note: noteStr !== undefined ? noteStr : (getPermission(fnName)?.note || '')
      };

      if (index >= 0) {
        newPerms[index] = updatedPerm;
      } else {
        newPerms.push(updatedPerm);
      }

      const res = await api.patch(`/projects/${projectId}`, { guest_permissions: newPerms });
      if (res.data?.success) {
        onProjectUpdate(res.data.data);
      }
    } catch {
      toast.error('Failed to update permissions');
    } finally {
      setSavingPerm(null);
    }
  };

  const handleToggleGlobalAccess = async (
    configKey: 'allow_read' | 'allow_write' | 'allow_payable',
    fnType: 'read' | 'write' | 'payable',
    checked: boolean
  ) => {
    if (checked) {
      handleUpdateGlobalConfig({ [configKey]: true });
    } else {
      if (!project || !contractAddress || !parsedAbi) {
        handleUpdateGlobalConfig({ [configKey]: false });
        return;
      }

      const fnsOfType = parsedAbi.functions[fnType] || [];
      const fnNames = fnsOfType.map(fn => fn.name);

      const newPerms = (project.guest_permissions || []).map(p => {
        if (p.contractAddress === contractAddress && fnNames.includes(p.methodName)) {
          return { ...p, isGlobalAllowed: false, allowedGuestList: [] };
        }
        return p;
      });

      const newConfig = { ...globalConfig, [configKey]: false };
      try {
        const res = await api.patch(`/projects/${projectId}`, {
          global_access_config: newConfig,
          guest_permissions: newPerms
        });
        if (res.data?.success) onProjectUpdate(res.data.data);
      } catch {
        toast.error('Failed to update config');
      }
    }
  };

  const renderToggle = (checked: boolean, onChange: (c: boolean) => void) => (
    <label className="toggle-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-slider"></span>
    </label>
  );

  return (
    <>
      {revokeConfirm && (
        <div className="modal-overlay" onClick={() => setRevokeConfirm(null)}>
          <div className="modal-content revoke-modal" onClick={e => e.stopPropagation()}>
            <div className="revoke-modal-icon">
              <HiOutlineExclamationTriangle size={32} />
            </div>
            <h3 className="revoke-modal-title">
              {revokeConfirm.type === 'guests'
                ? t('pages.interact.config.revoke_all_guests_title')
                : t('pages.interact.config.revoke_all_devs_title')}
            </h3>
            <p className="revoke-modal-msg">
              {revokeConfirm.type === 'guests'
                ? t('pages.interact.config.revoke_all_guests_msg')
                : t('pages.interact.config.revoke_all_devs_msg')}
            </p>
            <div className="revoke-modal-actions">
              <button className="btn btn-ghost" onClick={() => setRevokeConfirm(null)}>
                {t('pages.interact.config.cancel_revoke')}
              </button>
              <button className="btn btn-danger" onClick={handleConfirmRevoke}>
                {t('pages.interact.config.confirm_revoke')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="interact-sidebar animate-fade-in">
        <div className="config-tabs-header" style={{ display: 'flex', alignItems: 'center' }}>
          <button
            className={`config-tab-btn ${configTab === 'global' ? 'active' : ''}`}
            onClick={() => setConfigTab('global')}
          >
            {t('pages.interact.config.global')}
          </button>
          <button
            className={`config-tab-btn ${configTab === 'notes' ? 'active' : ''}`}
            onClick={() => setConfigTab('notes')}
          >
            {t('pages.interact.config.notes')}
          </button>
          <button 
            className="config-tab-btn" 
            style={{ flex: '0 0 auto', padding: '0 1rem', borderLeft: '1px solid var(--color-border)' }}
            onClick={onClose}
            title="Đóng bảng điều khiển"
          >
            <HiOutlineXMark size={20} />
          </button>
        </div>

        <div className="config-panel">
          {configTab === 'global' && (
            <>
              <div className="config-group">
                <div className="config-section-title">
                  <HiOutlineUsers size={16} /> {t('pages.interact.config.admission_guests')}
                </div>
                <div className="config-section-desc">{t('pages.interact.config.admission_guests_desc')}</div>
                <div className="config-input-group">
                  <input
                    className="input"
                    placeholder={t('pages.interact.config.email_placeholder')}
                    value={guestInviteEmail}
                    onChange={e => setGuestInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleInviteGuest()}
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleInviteGuest}>{t('pages.interact.config.btn_invite')}</button>
                </div>
                {(globalConfig.invited_guests || []).length > 0 && (
                  <div className="invited-list">
                    {globalConfig.invited_guests.map((email: string) => (
                      <div key={email} className="invited-chip">
                        <span className="invited-chip-email">{email}</span>
                        <button className="invited-chip-remove" onClick={() => handleRemoveGuest(email)} title={t('pages.interact.config.remove')}>
                          <HiOutlineXMark size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="config-toggle-row" style={{ padding: '8px 0 0', border: 'none' }}>
                  <div className="config-toggle-info">
                    <span className="config-toggle-label" style={{ fontSize: '13px' }}>{t('pages.interact.config.allow_all')}</span>
                  </div>
                  {renderToggle(globalConfig.allow_all_guests, handleToggleAllowAllGuests)}
                </div>
              </div>

              <div className="config-group">
                <div className="config-section-title">
                  <HiOutlineCommandLine size={16} /> {t('pages.interact.config.admission_devs')}
                </div>
                <div className="config-section-desc">{t('pages.interact.config.admission_devs_desc')}</div>
                <div className="config-input-group">
                  <input
                    className="input"
                    placeholder={t('pages.interact.config.dev_email_placeholder')}
                    value={devInviteEmail}
                    onChange={e => setDevInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleInviteDev()}
                  />
                  <button className="btn btn-secondary btn-sm" onClick={handleInviteDev}>
                    {t('pages.interact.config.btn_invite')}
                  </button>
                </div>
                {(project?.shared_devs || []).length > 0 && (
                  <div className="invited-list">
                    {project.shared_devs.map((devId: string) => (
                      <div key={devId} className="invited-chip invited-chip--dev">
                        <span className="invited-chip-email">{devId}</span>
                        <button className="invited-chip-remove" onClick={() => handleRemoveDev(devId)} title={t('pages.interact.config.remove')}>
                          <HiOutlineXMark size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="config-toggle-row" style={{ padding: '8px 0 0', border: 'none' }}>
                  <div className="config-toggle-info">
                    <span className="config-toggle-label" style={{ fontSize: '13px' }}>{t('pages.interact.config.allow_all')}</span>
                  </div>
                  {renderToggle(globalConfig.allow_all_devs, handleToggleAllowAllDevs)}
                </div>
              </div>

              <div className="config-group highlight">
                <div className="config-section-title">
                  <HiOutlineShieldCheck size={16} /> {t('pages.interact.config.global_access')}
                </div>
                <div className="config-section-desc">{t('pages.interact.config.global_access_desc')}</div>
                <div className="config-toggle-row">
                  <div className="config-toggle-info">
                    <span className="config-toggle-label">{t('pages.interact.config.read_access')}</span>
                    <span className="config-toggle-desc">{t('pages.interact.config.read_desc')}</span>
                  </div>
                  {renderToggle(globalConfig.allow_read, (checked) => handleToggleGlobalAccess('allow_read', 'read', checked))}
                </div>
                <div className="config-toggle-row">
                  <div className="config-toggle-info">
                    <span className="config-toggle-label">{t('pages.interact.config.write_access')}</span>
                    <span className="config-toggle-desc">{t('pages.interact.config.write_desc')}</span>
                  </div>
                  {renderToggle(globalConfig.allow_write, (checked) => handleToggleGlobalAccess('allow_write', 'write', checked))}
                </div>
                <div className="config-toggle-row">
                  <div className="config-toggle-info">
                    <span className="config-toggle-label">{t('pages.interact.config.payable_access')}</span>
                    <span className="config-toggle-desc">{t('pages.interact.config.payable_desc')}</span>
                  </div>
                  {renderToggle(globalConfig.allow_payable, (checked) => handleToggleGlobalAccess('allow_payable', 'payable', checked))}
                </div>
              </div>
            </>
          )}

          {configTab === 'notes' && (
            <div className="fn-notes-list">
              {currentFunctions.length === 0 && (
                <div className="fn-empty">Select a category with functions to take notes.</div>
              )}
              {currentFunctions.map(fn => {
                const perm = getPermission(fn.name);
                const isOverridden = isOverriddenByGlobal(fn);
                const isSaving = savingPerm === fn.name;

                return (
                  <div key={fn.name} className={`fn-note-card ${isSaving ? 'saving' : ''}`}>
                    <div className="fn-note-header">
                      <span>{fn.name}</span>
                      {isSaving && <span className="fn-saving-tag">{t('common.saving')}...</span>}
                    </div>

                    {isOverridden ? (
                      <div style={{ fontSize: '12px', color: 'var(--color-accent)', padding: '0.25rem 0' }}>
                        ⚡ {t('pages.interact.config.global_inherit_warn') || 'Inheriting from Global Access Control'}
                      </div>
                    ) : (
                      <div className="config-toggle-row" style={{ padding: 0, border: 'none', opacity: isSaving ? 0.5 : 1 }}>
                        <div className="config-toggle-info">
                          <span className="config-toggle-label" style={{ fontSize: '13px' }}>{t('pages.interact.config.allow_fn')}</span>
                        </div>
                        {renderToggle(perm?.isGlobalAllowed || false, (checked) => {
                          handleUpdatePermission(fn.name, checked, '', perm?.note);
                        })}
                      </div>
                    )}

                    <textarea
                      className="fn-note-textarea"
                      placeholder={t('pages.interact.config.notes_placeholder')}
                      defaultValue={perm?.note || ''}
                      disabled={isSaving}
                      onBlur={(e) => handleUpdatePermission(fn.name, perm?.isGlobalAllowed || false, '', e.target.value)}
                    ></textarea>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
