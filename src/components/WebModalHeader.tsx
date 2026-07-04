/**
 * Native implementation (no-op). On native platforms the modal header is
 * handled by the Stack navigator; see `WebModalHeader.web.tsx` for the web
 * implementation.
 */
export type TWebModalHeaderProps = {
  isDisabled?: boolean;
  onClose: () => void;
  onSave: () => void;
};

export function WebModalHeader(_props: TWebModalHeaderProps) {
  return null;
}
