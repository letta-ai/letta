import { useCallback, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';

export interface ImageAttachment {
  id: string;
  file: File;
  previewUrl: string;
  base64Data: string;
  mediaType: string;
  errorType?: 'file-too-large' | 'unknown';
}

const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

function validateImageFile(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type);
}

async function createImageAttachment(file: File): Promise<ImageAttachment> {
  const [base64Data, previewUrl] = await Promise.all([
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }),
    Promise.resolve(URL.createObjectURL(file)),
  ]);

  const maxFileSize = 5 * 1024 * 1024;
  const errorType = file.size > maxFileSize ? 'file-too-large' : undefined;

  return {
    id: `image-${Date.now()}-${Math.random()}`,
    file,
    previewUrl,
    base64Data,
    mediaType: file.type,
    errorType,
  };
}

export function useImageAttachments() {
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);

  const handleAddImages = useCallback(async (files: FileList) => {
    const imageFiles = Array.from(files).filter(validateImageFile);

    if (imageFiles.length === 0) {
      return;
    }

    try {
      const newImageAttachments = await Promise.all(
        imageFiles.map(createImageAttachment),
      );
      setImages((prev) => [...prev, ...newImageAttachments]);
    } catch (error) {
      console.error('Failed to process images:', error);
    }
  }, []);

  const handleRemoveImage = useCallback((imageId: string) => {
    setImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === imageId);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.previewUrl);
      }
      return prev.filter((img) => img.id !== imageId);
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggedOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggedOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggedOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        void handleAddImages(files);
      }
    },
    [handleAddImages],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        void handleAddImages(files);
      }
      if (hiddenFileInputRef.current) {
        hiddenFileInputRef.current.value = '';
      }
    },
    [handleAddImages],
  );

  const handleImageUploadClick = useCallback(() => {
    if (hiddenFileInputRef.current) {
      hiddenFileInputRef.current.click();
    }
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const clipboardData = e.clipboardData;

      if (clipboardData?.items) {
        const items = Array.from(clipboardData.items);
        const imageItems = items.filter((item) =>
          item.type.startsWith('image/'),
        );

        if (imageItems.length > 0) {
          e.preventDefault();

          const files: File[] = [];
          imageItems.forEach((item) => {
            const file = item.getAsFile();
            if (file && validateImageFile(file)) {
              files.push(file);
            }
          });

          if (files.length > 0) {
            const fileList = files as unknown as FileList;
            Object.defineProperty(fileList, 'length', {
              value: files.length,
            });
            files.forEach((file, index) => {
              Object.defineProperty(fileList, index, { value: file });
            });
            void handleAddImages(fileList);
          }
        }
      }
    },
    [handleAddImages],
  );

  const hasImageErrors = useMemo(() => {
    return images.some((image) => !!image.errorType);
  }, [images]);

  const clearImages = useCallback(() => {
    setImages([]);
  }, []);

  return {
    images,
    isDraggedOver,
    hasImageErrors,
    hiddenFileInputRef,
    acceptedImageTypes: ACCEPTED_IMAGE_TYPES,
    handleAddImages,
    handleRemoveImage,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    handleImageUploadClick,
    handlePaste,
    clearImages,
  };
}
