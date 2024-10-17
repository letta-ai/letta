import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import './FileTree.scss';
import {
  FolderIcon,
  FolderOpenIcon,
  FileIcon,
  DotsHorizontalIcon,
} from '../../icons';
import { LettaLoader } from '../LettaLoader/LettaLoader';
import { useTranslations } from 'next-intl';
import { Typography } from '../Typography/Typography';
import { useMemo } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { DropdownMenu, DropdownMenuItem } from '../DropdownMenu/DropdownMenu';

interface Action {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  id: string;
}

interface RootType {
  name: string;
  id?: string;
  actions?: Action[];
}

interface FileType extends RootType {
  onClick?: () => void;
  icon?: React.ReactNode;
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
}

export function getIsGenericFolder(
  folder: unknown
): folder is GenericFolderType {
  return Object.prototype.hasOwnProperty.call(folder, 'contents');
}

interface RowItemProps {
  depth: number;
  children: React.ReactNode;
  onClick?: () => void;
  actions?: Action[];
}

function RowItem(props: RowItemProps) {
  const { depth, onClick, actions } = props;

  return (
    <li className="w-full block">
      <HStack
        justify="spaceBetween"
        align="center"
        as={onClick ? 'button' : 'div'}
        onClick={onClick}
        paddingRight
        style={{
          paddingLeft: `${depth * 20}px`,
        }}
        className="hover:bg-tertiary-hover cursor-pointer"
        fullWidth
        paddingY="small"
      >
        <HStack align="center">{props.children}</HStack>
        {actions && (
          <DropdownMenu trigger={<DotsHorizontalIcon className="w-4" />}>
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                onClick={action.onClick}
                preIcon={action.icon}
                label={action.label}
              />
            ))}
          </DropdownMenu>
        )}
      </HStack>
    </li>
  );
}

interface RootFolderType extends RootType {
  icon?: React.ReactNode;
  openIcon?: React.ReactNode;
  defaultOpen?: boolean;
}

interface GenericFolderType extends RootFolderType {
  contents: FileTreeContentsType;
}

interface AsyncFolderType extends RootFolderType {
  useContents: () => { data: FileTreeContentsType; isLoading: boolean };
}

type FolderType = AsyncFolderType | GenericFolderType;

export type FileTreeContentsType = Array<FileType | FolderType>;

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
          <HStack fullWidth align="center" fullHeight>
            <HStack align="center">
              {icon ? (
                <Slot className="w-4">{icon}</Slot>
              ) : (
                <FileIcon className="w-4" />
              )}
              <Typography>{name}</Typography>
            </HStack>
          </HStack>
        );

        if (content.wrapper) {
          innerContent = <content.wrapper>{innerContent}</content.wrapper>;
        }

        return (
          <RowItem
            onClick={onClick}
            actions={actions}
            depth={depth + 1}
            key={index}
          >
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

  const { name, actions, useContents } = folder;

  const { data, isLoading } = useContents();

  if (isLoading) {
    return (
      <RowItem depth={depth + 1}>
        <LettaLoader size="small" /> {t('loading')}
      </RowItem>
    );
  }

  return (
    <RenderFolderInnerContent
      folder={{ name, actions, contents: data }}
      depth={depth}
    />
  );
}

interface FolderComponentProps {
  folder: FolderType;
  depth?: number;
}

export function FolderComponent(props: FolderComponentProps) {
  const { folder, depth = 0 } = props;
  const {
    name,
    actions,
    defaultOpen,
    openIcon: openIconOverride,
    icon: iconOverride,
  } = folder;

  const [isOpen, setIsOpen] = React.useState(defaultOpen || false);

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
        <RowItem actions={actions} depth={depth}>
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
  root: FileTreeContentsType;
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
