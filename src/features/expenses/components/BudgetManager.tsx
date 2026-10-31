import React, { useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { useAppData } from '../../../services/store/AppDataContext';
import { getMemberGroupIds } from '../../groups/utils/membership';
import { BudgetRequestSheet, type BudgetRequestDraft } from './BudgetRequestSheet';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { triggerHapticFeedback } from '../../../components/ui/haptics';
import { requestBudget } from '../../../services/api/gasClient';
import { compressImageFile } from '../../../utils/imageCompressor';

interface BudgetManagerProps {
  onRequestSubmit?: (request: BudgetRequestDraft) => Promise<void>;
}

export const BudgetManager: React.FC<BudgetManagerProps> = ({ onRequestSubmit }) => {
  const { groups, members, member_groups, current_user, refreshData } = useAppData();
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const currentUser = current_user ?? members.find((member) => member.is_active);
  const groupIds = getMemberGroupIds(currentUser?.user_id, member_groups);
  const visibleGroups = groups.filter((group) => groupIds.has(group.group_id));

  const handleRequestSubmit = async (request: BudgetRequestDraft) => {
    setIsProcessingRequest(true);
    setNotice(null);
    try {
      if (onRequestSubmit) {
        await onRequestSubmit(request);
      } else {
        let screenshotBase64 = '';
        if (request.screenshot) {
          screenshotBase64 = await compressImageFile(request.screenshot);
        }
        await requestBudget({
          group_id: request.groupId,
          amount: request.amount,
          is_cash: request.paymentMethod === 'CASH',
          reason: request.reason,
          screenshot: screenshotBase64
        });
        await refreshData();
      }
      triggerHapticFeedback();
      setNotice('Budget request submitted for flatmate review.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not submit budget request.';
      setNotice(msg);
    } finally {
      setIsProcessingRequest(false);
    }
  };

  return (
    <section aria-labelledby="budget-manager-title" className="mt-5">
      <div className="flex items-center justify-between gap-3 border-y border-zinc-800/40 py-3">
        <div className="min-w-0">
          <h3 id="budget-manager-title" className="text-sm font-medium text-zinc-100">Need more budget?</h3>
          <p className="mt-1 text-xs text-zinc-500">Request funds for a household group.</p>
        </div>
        <button
          type="button"
          onClick={() => { triggerHapticFeedback(); setNotice(null); setIsRequestOpen(true); }}
          disabled={!visibleGroups.length}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium text-sky-400 transition-colors hover:bg-sky-500/10 focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" /> Request
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
      {isProcessingRequest && <LoadingSkeleton rows={1} className="mt-3" />}
      {notice && <p role="status" className="mt-3 text-sm text-amber-300">{notice}</p>}
      <BudgetRequestSheet isOpen={isRequestOpen} groups={visibleGroups} onClose={() => setIsRequestOpen(false)} onSubmit={handleRequestSubmit} />
    </section>
  );
};
