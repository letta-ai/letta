import { Dialog } from '@letta-cloud/ui-component-library';

interface ManageModelVisibilityProps {
  trigger: React.ReactNode;
}

export function ManageModelVisibility(props: ManageModelVisibilityProps) {
  const { trigger } = props;

  return <Dialog trigger={trigger}></Dialog>;
}
