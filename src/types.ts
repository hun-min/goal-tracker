export interface Session {
  id: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
}

export interface Goal {
  id: string;
  parentId: string | null;
  name: string;
  totalSeconds: number;
  color: string;
  createdAt: number;
  isArchived?: boolean;
  history?: Session[];
}
