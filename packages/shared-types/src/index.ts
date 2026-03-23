export type SubjectId = string;

export interface SubjectClaimSet {
  subjectId: SubjectId;
  channel: string;
  accountId?: string;
  conversationId?: string;
  roles?: string[];
  departments?: string[];
}
