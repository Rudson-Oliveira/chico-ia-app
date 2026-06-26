
export type Agent = string;

export interface ConversationMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
  summary?: string; // Optional summary for any long message
  imageUrl?: string; // To store a URL for a user-sent image
  fileName?: string; // To store the name of an uploaded file
  blockType?: 'code' | 'text' | 'prompt'; // To identify a message as a code block, text to copy, or prompt
}

export interface Conversation {
  id: string; // Firestore document ID
  uid: string; // Foreign key to user
  title: string;
  createdAt: Date; // From Firestore timestamp
  isArchived?: boolean; // To support the archive feature
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  subscriptionStatus: 'pending' | 'active' | 'inactive' | 'canceled';
  createdAt: Date;
  lastSeen?: Date; // New field to track when user was last active
  profilePicUrl?: string;
  theme?: string;
  customThemeColor?: string; // New field for custom accent color
  voiceName?: string; // Voice preference (e.g., 'Kore', 'Fenrir')
  textToSpeechEnabled?: boolean; // Preference to read text responses aloud
  usingOwnKey?: boolean; // Tracks if the user is using their own API key
  allowedIP?: string; // Security field to enforce single IP access
  termsAccepted?: boolean; // Tracks if the user accepted the terms
  termsAcceptedAt?: Date; // When the terms were accepted
  usage?: {
    totalTokens: number;
    totalCost: number;
    remainingTokens: number;
  };
  programmingLevel?: 'basic' | 'intermediate' | 'advanced';
  chicoCustomName?: string;
  userPreferredName?: string;
  socialLinks?: {
    instagram?: string;
    site?: string;
    facebook?: string;
  };
  integrations?: {
    openClaw?: {
      enabled: boolean;
      localUrl: string;
      remoteUrl: string;
      useRemote: boolean;
    };
    ollama?: {
      enabled: boolean;
      url: string;
    };
    claudeCode?: {
      enabled: boolean;
      apiKey: string;
    };
  };
}

export interface CustomAgent {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
  createdAt: Date;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  videoUrl?: string;
  linkUrl?: string; // URL for the clickable button
  linkText?: string; // Text for the clickable button
  createdAt: Date;
  viewCount?: number; // Tracks how many users have opened this notification
}

export interface BugReport {
  id: string;
  uid: string;
  userName: string;
  userEmail: string;
  whatsapp: string;
  description: string;
  screenshotUrl?: string;
  createdAt: Date;
  status: 'open' | 'resolved';
}

// === RPA Types ===

export type RpaStepType = 'navigate' | 'click' | 'type' | 'extract' | 'wait' | 'screenshot' | 'condition' | 'loop' | 'script' | 'getPageMap' | 'scroll' | 'hover' | 'wait_for_element';

export type RpaStepStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

export type RpaWorkflowStatus = 'idle' | 'running' | 'completed' | 'error' | 'paused';

export interface RpaStepConfig {
  url?: string;
  selector?: string;
  text?: string;
  attribute?: string;
  timeout?: number;
  script?: string;
  condition?: string;
  loopCount?: number;
  description?: string;
}

export interface RpaStep {
  id: string;
  type: RpaStepType;
  label: string;
  config: RpaStepConfig;
  status: RpaStepStatus;
  result?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface RpaWorkflow {
  id: string;
  uid: string;
  name: string;
  description: string;
  steps: RpaStep[];
  status: RpaWorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date;
  lastRunDuration?: number;
  tags?: string[];
}

export interface RpaLogEntry {
  id: string;
  workflowId: string;
  stepId: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: any;
}