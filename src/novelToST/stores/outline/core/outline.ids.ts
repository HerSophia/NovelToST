let outlineNodeCounter = 0;
export function createOutlineNodeId(): string {
  outlineNodeCounter += 1;
  return `outline-node-${Date.now()}-${outlineNodeCounter}`;
}

let storylineCounter = 0;
export function createStorylineId(): string {
  storylineCounter += 1;
  return `storyline-${Date.now()}-${storylineCounter}`;
}

let outlineSessionCounter = 0;
export function createOutlineSessionId(): string {
  outlineSessionCounter += 1;
  return `outline-session-${Date.now()}-${outlineSessionCounter}`;
}

let outlineMessageCounter = 0;
export function createOutlineMessageId(): string {
  outlineMessageCounter += 1;
  return `outline-message-${Date.now()}-${outlineMessageCounter}`;
}

let outlineSnapshotCounter = 0;
export function createOutlineSnapshotId(): string {
  outlineSnapshotCounter += 1;
  return `outline-snapshot-${Date.now()}-${outlineSnapshotCounter}`;
}
