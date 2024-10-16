'use client';
import toast, { ToastBar, Toaster as ToasterPrimitive } from 'react-hot-toast';
import React from 'react';
import type { AlertVariants } from '../Alert/Alert';
import { Alert } from '../Alert/Alert';
import { Cross2Icon } from '../../icons';

function Toaster() {
  return (
    <ToasterPrimitive position="top-right">
      {(t) => (
        <ToastBar
          style={{
            borderRadius: 0,
            padding: 0,
            background: 'transparent',
            boxShadow: 'none',
            border: 0,
          }}
          toast={t}
        >
          {({ message }) => {
            let variant: AlertVariants = 'info';

            if (t.type === 'error') {
              variant = 'destructive';
            }

            return (
              <Alert
                action={
                  t.type !== 'loading' && (
                    <button
                      onClick={() => {
                        toast.dismiss(t.id);
                      }}
                    >
                      <Cross2Icon />
                    </button>
                  )
                }
                title={message}
                variant={variant}
              ></Alert>
            );
          }}
        </ToastBar>
      )}
    </ToasterPrimitive>
  );
}

export { Toaster, toast };
