export interface LettaConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  verbose?: boolean;
  retries?: number;
}

export interface EmbeddingConfig {
  embedding_endpoint_type: string;
  embedding_endpoint: string;
  embedding_model: string;
  embedding_dim: number;
  embedding_chunk_size: number;
  handle?: string | null;
  batch_size: number;
  azure_endpoint?: string | null;
  azure_version?: string | null;
  azure_deployment?: string | null;
}

export interface LettaFolder {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  embedding_config: EmbeddingConfig;
  created_at: string;
  updated_at: string;
}

export interface LettaFile {
  id: string;
  folder_id: string;
  file_name: string;
  original_file_name: string;
  file_size: number;
  file_type: string;
  created_at: string;
  updated_at: string;
}

export interface LettaUploadResult {
  id: string;
  source_id: string;
  file_name: string;
  original_file_name: string;
  file_size: number;
  file_type: string;
  processing_status: string;
  created_at: string;
  updated_at: string;
}

export interface LettaJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface LocalFile {
  fullPath: string;
  relativePath: string;
  size: number;
  isDirectory: boolean;
}

export interface SyncOptions {
  source: string;
  targetFolder: string;
  duplicateHandling?: 'replace' | 'skip' | 'error';
  verbose?: boolean;
}

export interface SyncResult {
  uploaded: LocalFile[];
  skipped: LocalFile[];
  errors: { file: LocalFile; error: string }[];
  totalFiles: number;
  totalSize: number;
}

export interface TreeNode {
  name: string;
  fullPath: string;
  size?: number;
  isDirectory: boolean;
  children?: TreeNode[];
}

export interface UploadProgress {
  file: LocalFile;
  progress: number;
  completed: boolean;
  error?: string;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
}