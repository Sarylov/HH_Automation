import {
  applyErrorMessage,
  isApplyWarningReason,
} from './apply-reasons';

describe('apply-reasons', () => {
  it('treats cover letter issues as warnings', () => {
    expect(isApplyWarningReason('cover_letter_attach_failed')).toBe(true);
    expect(isApplyWarningReason('chat_not_available_after_apply')).toBe(false);
  });

  it('maps success reasons to null errorMessage', () => {
    expect(applyErrorMessage('cover_letter_sent_via_chat')).toBeNull();
    expect(applyErrorMessage(undefined)).toBeNull();
  });

  it('maps warning reasons to errorMessage code', () => {
    expect(applyErrorMessage('cover_letter_skipped')).toBe(
      'cover_letter_skipped',
    );
  });
});
