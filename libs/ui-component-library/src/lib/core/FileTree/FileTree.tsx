'use client';
import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import './FileTree.scss';
import {
  FolderIcon,
  FolderOpenIcon,
  FileIcon,
  CaretDownIcon,
  CaretRightIcon,
  DotsVerticalIcon,
} from '../../icons';
import { LettaLoader } from '../LettaLoader/LettaLoader';
import { useTranslations } from '@letta-cloud/translations';
import { Typography } from '../Typography/Typography';
import { useMemo } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { DropdownMenu, DropdownMenuItem } from '../DropdownMenu/DropdownMenu';
import { Button } from '../Button/Button';
import { InfoTooltip } from '../../reusable/InfoTooltip/InfoTooltip';

interface Action {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  id: string;
}

interface RootType {
  name: string;
  id?: string;
  badge?: React.ReactNode;
  infoTooltip?: {
    text: string;
  };
  actions?: Action[];
  actionNode?: React.ReactNode;
}

interface FileType extends RootType {
  onClick?: () => void;
  icon?: React.ReactNode;
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
}

export function getIsGenericFolder(
  folder: unknown,
): folder is GenericFolderType {
  return Object.prototype.hasOwnProperty.call(folder, 'contents');
}

interface RowItemProps {
  depth: number;
  badge?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  actions?: Action[];
  actionNode?: React.ReactNode;
  index: number;
}

function RowItem(props: RowItemProps) {
  const { depth, index, badge, onClick, actions, actionNode } = props;

  return (
    <li className="w-full relative block">
      <HStack
        justify="spaceBetween"
        align="center"
        as={onClick ? 'button' : 'div'}
        onClick={onClick}
        paddingRight
        style={{
          paddingLeft: `${(depth - 1) * 20}px`,
        }}
        className="hover:bg-secondary-hover py-1.5 cursor-pointer"
        fullWidth
        overflow="hidden"
      >
        <HStack overflow="hidden" collapseWidth justify="start" align="center">
          {props.children}
        </HStack>
        <HStack align="center">{badge}</HStack>
      </HStack>
      <HStack
        className="absolute right-5 top-0 h-full"
        align="center"
        gap="small"
      >
        {actionNode}
        {actions && (
          <DropdownMenu
            triggerAsChild
            trigger={
              <Button
                label="Actions"
                color="tertiary"
                size="small"
                hideLabel
                data-testid={`filetree-actions:${depth}-${index}`}
                preIcon={<DotsVerticalIcon className="w-4" />}
              />
            }
          >
            {actions.map((action) => (
              <DropdownMenuItem
                data-testid={`filetree-action-${action.id}`}
                key={action.id || action.label}
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
            <FolderComponent
              depth={depth + 1}
              index={index}
              key={index}
              folder={content}
            />
          );
        }

        const { name, onClick, icon, actionNode, actions } = content;
        let innerContent = (
          <HStack justify="start" fullWidth align="center" fullHeight>
            <HStack justify="start" align="center">
              {icon ? (
                <Slot className="w-4">{icon}</Slot>
              ) : (
                <FileIcon className="w-4" />
              )}
              <Typography overflow="ellipsis" fullWidth noWrap align="left">
                {name}
              </Typography>
            </HStack>
          </HStack>
        );

        if (content.wrapper) {
          innerContent = <content.wrapper>{innerContent}</content.wrapper>;
        }

        return (
          <RowItem
            index={index}
            onClick={onClick}
            actions={actions}
            actionNode={actionNode}
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
      <RowItem index={0} depth={depth + 1}>
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
  index?: number;
}

export function FolderComponent(props: FolderComponentProps) {
  const { folder, index = 0, depth = 0 } = props;
  const {
    name,
    badge,
    actions,
    actionNode,
    infoTooltip,
    defaultOpen,
    openIcon: openIconOverride,
    icon: iconOverride,
  } = folder;

  const [isOpen, setIsOpen] = React.useState(defaultOpen || false);

  const openIcon = useMemo(() => {
    if (openIconOverride) {
      return (
        <HStack gap="text">
          <CaretDownIcon />
          <Slot className="w-4">{openIconOverride}</Slot>
        </HStack>
      );
    }

    return (
      <HStack gap="text">
        <CaretDownIcon />
        <FolderOpenIcon className="w-4" />
      </HStack>
    );
  }, [openIconOverride]);

  const icon = useMemo(() => {
    if (iconOverride) {
      return (
        <HStack gap="text">
          <CaretRightIcon />
          <Slot className="w-4">{iconOverride}</Slot>;
        </HStack>
      );
    }

    return (
      <HStack gap="text">
        <CaretRightIcon />
        <FolderIcon className="w-4" />
      </HStack>
    );
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
        <RowItem
          index={index}
          badge={badge}
          actionNode={actionNode}
          actions={actions}
          depth={depth}
        >
          {isOpen ? openIcon : icon}
          <HStack align="center">
            <Typography overflow="ellipsis" fullWidth noWrap align="left">
              {name}
            </Typography>
            {infoTooltip && (
              <>
                {' '}
                <InfoTooltip text={infoTooltip.text} />
              </>
            )}
          </HStack>
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
