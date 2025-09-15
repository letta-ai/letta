import axios, { AxiosInstance, AxiosError } from 'axios';
import axiosRetry, { exponentialDelay } from 'axios-retry';
import FormData from 'form-data';
import * as fs from 'fs-extra';
import {
  LettaConfig,
  LettaFolder,
  LettaFile,
  LettaJob,
  LettaUploadResult,
  EmbeddingConfig,
  ApiError
} from '../types.js';

export class LettaClient {
  private api: AxiosInstance;
  private verbose: boolean;

  constructor(config: LettaConfig) {
    this.verbose = config.verbose || false;
    this.api = axios.create({
      baseURL: config.baseUrl || 'https://api.letta.com/v1',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: config.timeout || parseInt(process.env.LETTA_TIMEOUT || '30000'),
      // Enable keep-alive
      httpAgent: new (require('http').Agent)({ keepAlive: true }),
      httpsAgent: new (require('https').Agent)({ keepAlive: true }),
    });

    // Configure retry logic
    axiosRetry(this.api, {
      retries: config.retries || 3,
      retryDelay: exponentialDelay,
      retryCondition: (error: AxiosError) => {
        // Retry on network errors, timeouts, and 5xx errors
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               error.code === 'ECONNABORTED' ||
               (error.response?.status ? error.response.status >= 500 : false);
      },
      onRetry: (retryCount, error) => {
        if (this.verbose) {
          console.log(`Retry attempt ${retryCount} for ${error.config?.url}: ${error.message}`);
        }
      }
    });

    // Add request interceptor for logging
    this.api.interceptors.request.use(
      (config) => {
        if (this.verbose) {
          console.log(`→ ${config.method?.toUpperCase()} ${config.url}`);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling and logging
    this.api.interceptors.response.use(
      (response) => {
        if (this.verbose) {
          console.log(`← ${response.status} ${response.config.url} (${response.headers['content-length'] || 'unknown'} bytes)`);
        }
        return response;
      },
      (error) => {
        if (this.verbose) {
          console.log(`✗ ${error.config?.url}: ${error.message}`);
        }
        
        const apiError: ApiError = this.createDetailedError(error);
        throw apiError;
      }
    );
  }

  private createDetailedError(error: any): ApiError {
    let message = error.message;
    
    if (error.code === 'ECONNABORTED') {
      message = `Request timeout after ${error.config?.timeout || 'unknown'}ms. This may be due to network issues or API slowness.`;
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      message = `Connection failed: ${error.message}. Please check your internet connection.`;
    } else if (error.response?.status === 401) {
      message = 'Authentication failed. Please check your API key.';
    } else if (error.response?.status === 403) {
      message = 'Access forbidden. Please check your API key permissions.';
    } else if (error.response?.status >= 500) {
      message = `Letta API server error (${error.response.status}). Please try again later.`;
    } else if (error.response?.data?.message) {
      message = error.response.data.message;
    }

    const apiError: ApiError = new Error(message);
    apiError.status = error.response?.status;
    apiError.code = error.code || error.response?.data?.code;
    return apiError;
  }

  // Embedding Models
  async getEmbeddingConfigs(): Promise<EmbeddingConfig[]> {
    const response = await this.api.get('embedding_models');
    return response.data;
  }

  // Folders
  async listFolders(): Promise<LettaFolder[]> {
    const response = await this.api.get('folders');
    return response.data;
  }

  async getFolderCount(): Promise<number> {
    const response = await this.api.get('folders/count');
    return response.data;
  }

  async getFolderByName(name: string): Promise<LettaFolder | null> {
    try {
      // First get the folder ID
      const nameResponse = await this.api.get(`folders/name/${encodeURIComponent(name)}`);
      const folderId = nameResponse.data;
      
      if (!folderId) {
        return null;
      }
      
      // Then get the full folder object
      const folderResponse = await this.api.get(`folders/${folderId}`);
      return folderResponse.data;
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getFolderIdByName(name: string): Promise<string | null> {
    try {
      const response = await this.api.get(`folders/name/${encodeURIComponent(name)}`);
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async createFolder(
    name: string,
    description?: string,
    instructions?: string
  ): Promise<LettaFolder> {
    // Cloud API uses default embedding config automatically
    const response = await this.api.post('folders', {
      name,
      description,
      instructions
    });
    return response.data;
  }

  async deleteFolder(folderId: string): Promise<void> {
    await this.api.delete(`folders/${folderId}`);
  }

  // Files
  async listFiles(folderId: string): Promise<LettaFile[]> {
    const response = await this.api.get(`folders/${folderId}/files`);
    return response.data;
  }

  async uploadFile(
    folderId: string,
    filePath: string,
    customName?: string
  ): Promise<LettaUploadResult> {
    const formData = new FormData();
    const fileStream = fs.createReadStream(filePath);
    const fileName = customName || filePath.split('/').pop() || 'unknown';
    
    formData.append('file', fileStream);
    formData.append('name', fileName);
    formData.append('duplicate_handling', 'replace');

    const response = await this.api.post(`folders/${folderId}/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${process.env.LETTA_API_KEY}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    return response.data;
  }

  async deleteFile(folderId: string, fileName: string): Promise<void> {
    const files = await this.listFiles(folderId);
    const file = files.find(f => 
      f.file_name === fileName || f.original_file_name === fileName
    );
    
    if (!file) {
      throw new Error(`File '${fileName}' not found in folder`);
    }

    await this.api.delete(`folders/${folderId}/files/${file.id}`);
  }

  // Jobs
  async getJob(jobId: string): Promise<LettaJob> {
    const response = await this.api.get(`jobs/${jobId}`);
    return response.data;
  }

  async waitForJob(jobId: string, timeoutMs: number = 300000): Promise<LettaJob> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const job = await this.getJob(jobId);
      
      if (job.status === 'completed') {
        return job;
      }
      
      if (job.status === 'failed') {
        throw new Error(`Job failed: ${job.metadata || 'Unknown error'}`);
      }
      
      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Job timeout after ${timeoutMs}ms`);
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      const startTime = Date.now();
      await this.api.get('health');
      const duration = Date.now() - startTime;
      
      if (this.verbose) {
        console.log(`Health check completed in ${duration}ms`);
      }
      
      return true;
    } catch (error) {
      if (this.verbose) {
        console.log(`Health check failed: ${error}`);
      }
      return false;
    }
  }
}