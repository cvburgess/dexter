// Native no-op — the Stack navigator handles the modal header there;
// see WebModalHeader.web.tsx.
export type TWebModalHeaderProps = {
  isDisabled?: boolean;
  onClose: () => void;
  onSave: () => void;
};

export function WebModalHeader(_props: TWebModalHeaderProps) {
  return null;
}
