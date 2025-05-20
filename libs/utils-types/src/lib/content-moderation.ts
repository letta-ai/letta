export interface ContentModerationResponse {
  id: string;
  model: string;
  results: Result[];
}

interface Result {
  flagged: boolean;
  categories: Categories;
  category_scores: CategoryScores;
  category_applied_input_types: CategoryAppliedInputTypes;
}

interface Categories {
  sexual: boolean;
  'sexual/minors': boolean;
  harassment: boolean;
  'harassment/threatening': boolean;
  hate: boolean;
  'hate/threatening': boolean;
  illicit: boolean;
  'illicit/violent': boolean;
  'self-harm': boolean;
  'self-harm/intent': boolean;
  'self-harm/instructions': boolean;
  violence: boolean;
  'violence/graphic': boolean;
}

interface CategoryScores {
  sexual: number;
  'sexual/minors': number;
  harassment: number;
  'harassment/threatening': number;
  hate: number;
  'hate/threatening': number;
  illicit: number;
  'illicit/violent': number;
  'self-harm': number;
  'self-harm/intent': number;
  'self-harm/instructions': number;
  violence: number;
  'violence/graphic': number;
}

interface CategoryAppliedInputTypes {
  sexual: string[];
  'sexual/minors': string[];
  harassment: string[];
  'harassment/threatening': string[];
  hate: string[];
  'hate/threatening': string[];
  illicit: string[];
  'illicit/violent': string[];
  'self-harm': string[];
  'self-harm/intent': string[];
  'self-harm/instructions': string[];
  violence: string[];
  'violence/graphic': string[];
}
