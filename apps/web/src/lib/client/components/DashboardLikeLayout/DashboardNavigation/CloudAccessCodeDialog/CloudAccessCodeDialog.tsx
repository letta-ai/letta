import React, { useCallback } from 'react';
import { z } from 'zod';
import {
  Button,
  Dialog,
  FormField,
  FormProvider,
  Input,
  useForm,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { webApi } from '@letta-cloud/sdk-web';

const CloudAccessCodeSchema = z.object({
  accessCode: z.string(),
});

type CloudAccessCodeFormType = z.infer<typeof CloudAccessCodeSchema>;

export function CloudAccessCodeDialog() {
  const form = useForm<CloudAccessCodeFormType>({
    resolver: zodResolver(CloudAccessCodeSchema),
    defaultValues: {
      accessCode: '',
    },
  });

  const { mutate, isError, isSuccess, isPending } =
    webApi.cloudAccessCode.submitCloudAccessCode.useMutation({
      onSuccess: () => {
        window.location.href = '/';
      },
    });

  const handleSubmit = useCallback(
    (values: CloudAccessCodeFormType) => {
      mutate({
        body: {
          code: values.accessCode,
        },
      });
    },
    [mutate],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={isError ? 'Wrong access code' : ''}
        title="Enter Access Code"
        onSubmit={form.handleSubmit(handleSubmit)}
        confirmText="Submit"
        isConfirmBusy={isPending || isSuccess}
        trigger={
          <Button label="Have an access code?" size="small" color="tertiary" />
        }
      >
        Enter your access code to enable Letta Cloud
        <FormField
          name="accessCode"
          render={({ field }) => (
            <Input
              labelVariant="simple"
              fullWidth
              hideLabel
              placeholder="Access Code"
              label="Access Code"
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}
