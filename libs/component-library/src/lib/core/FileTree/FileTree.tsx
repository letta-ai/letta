import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import './FileTree.scss';
import { FolderIcon, FolderOpenIcon, FileIcon } from '../../icons';
import { LettaLoader } from '../LettaLoader/LettaLoader';
import { useTranslations } from 'next-intl';
import { Typography } from '../Typography/Typography';
import { useMemo } from 'react';
import { Slot } from '@radix-ui/react-slot';

interface FileType {
  name: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
  actions?: React.ReactNode;
}

interface RowItemProps {
  depth: number;
  children: React.ReactNode;
}

function RowItem(props: RowItemProps) {
  const { depth } = props;

  return (
    <HStack
      align="center"
      as="li"
      style={{
        paddingLeft: `${depth * 20}px`,
      }}
      className="hover:bg-tertiary-hover cursor-pointer"
      fullWidth
      paddingY="small"
    >
      {props.children}
    </HStack>
  );
}

interface RootFolderType {
  name: string;
  icon?: React.ReactNode;
  openIcon?: React.ReactNode;
}

interface GenericFolderType extends RootFolderType {
  contents: ContentsType;
}

interface AsyncFolderType extends RootFolderType {
  useContents: () => { data: ContentsType; isLoading: boolean };
}

type FolderType = AsyncFolderType | GenericFolderType;

type ContentsType = Array<FileType | FolderType>;

interface RenderFolderContentProps {
  folder: GenericFolderType;
  depth?: number;
}

function RenderFolderInnerContent(props: RenderFolderContentProps) {
  const { folder, depth = 0 } = props;
  const { contents } = folder;

  return (
    <ul>
      {contents.map((content, index) => {
        if ('contents' in content || 'useContents' in content) {
          return (
            <FolderComponent depth={depth + 1} key={index} folder={content} />
          );
        }

        const { name, onClick, icon, actions } = content;
        let innerContent = (
          <HStack
            fullWidth
            as={onClick ? 'button' : 'div'}
            onClick={onClick}
            align="center"
          >
            {icon ? (
              <Slot className="w-4">{icon}</Slot>
            ) : (
              <FileIcon className="w-4" />
            )}
            <Typography>{name}</Typography>
            {actions}
          </HStack>
        );

        if (content.wrapper) {
          innerContent = <content.wrapper>{innerContent}</content.wrapper>;
        }

        return (
          <RowItem depth={depth + 1} key={index}>
            {innerContent}
          </RowItem>
        );
      })}
    </ul>
  );
}

interface RenderAsyncFolderContentProps {
  folder: AsyncFolderType;
  depth?: number;
}

function RenderAsyncFolderInnerContent(props: RenderAsyncFolderContentProps) {
  const { folder, depth = 0 } = props;
  const t = useTranslations('ComponentLibrary/FileTree');

  const { name, useContents } = folder;

  const { data, isLoading } = useContents();

  if (isLoading) {
    return (
      <RowItem depth={depth + 1}>
        <LettaLoader size="small" /> {t('loading')}
      </RowItem>
    );
  }

  return (
    <RenderFolderInnerContent folder={{ name, contents: data }} depth={depth} />
  );
}

interface FolderComponentProps {
  folder: FolderType;
  depth?: number;
}

export function FolderComponent(props: FolderComponentProps) {
  const { folder, depth = 0 } = props;
  const [isOpen, setIsOpen] = React.useState(false);
  const { name, openIcon: openIconOverride, icon: iconOverride } = folder;

  const openIcon = useMemo(() => {
    if (openIconOverride) {
      return <Slot className="w-4">{openIconOverride}</Slot>;
    }

    return <FolderOpenIcon className="w-4" />;
  }, [openIconOverride]);

  const icon = useMemo(() => {
    if (iconOverride) {
      return <Slot className="w-4">{iconOverride}</Slot>;
    }

    return <FolderIcon className="w-4" />;
  }, [iconOverride]);

  return (
    <details
      className="w-full"
      open={isOpen}
      onToggle={(e) => {
        e.stopPropagation();
        setIsOpen((e.target as HTMLDetailsElement).open);
      }}
    >
      <HStack as="summary" className="w-full cursor-pointer" align="center">
        <RowItem depth={depth}>
          {isOpen ? openIcon : icon}
          <Typography>{name}</Typography>
        </RowItem>
      </HStack>
      {'contents' in folder ? (
        <RenderFolderInnerContent folder={folder} depth={depth} />
      ) : (
        <RenderAsyncFolderInnerContent folder={folder} depth={depth} />
      )}
    </details>
  );
}

interface FileTreeProps {
  root: ContentsType;
}

export function FileTree(props: FileTreeProps) {
  return (
    <ul>
      <RenderFolderInnerContent
        folder={{
          name: 'Root',
          contents: props.root,
        }}
        depth={0}
      />
    </ul>
  );
}
