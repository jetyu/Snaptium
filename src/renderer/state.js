const state = {
  editor: null,
  fileContents: new Map(),
  currentFileItem: null,
  currentFilePath: null,
  autoSaveTimer: null,
  currentNodeId: null,
  workspaceRoot: null,
  nodes: new Map(),
  selectNodeToken: 0,
  isLoadingNote: false,
};

export default state;
