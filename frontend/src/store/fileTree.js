import { create } from 'zustand'

export const useFileTreeStore = create((set, get) => ({
  expandedKeys: [],
  selectedKey: null,
  treeData: [],
  
  setExpandedKeys: (keys) => set({ expandedKeys: keys }),
  
  setSelectedKey: (key) => set({ selectedKey: key }),
  
  setTreeData: (data) => set({ treeData: data }),
  
  expandNode: (key) => {
    const keys = get().expandedKeys
    if (!keys.includes(key)) {
      set({ expandedKeys: [...keys, key] })
    }
  },
  
  collapseNode: (key) => {
    const keys = get().expandedKeys
    set({ expandedKeys: keys.filter(k => k !== key) })
  },
  
  toggleNode: (key) => {
    const keys = get().expandedKeys
    if (keys.includes(key)) {
      set({ expandedKeys: keys.filter(k => k !== key) })
    } else {
      set({ expandedKeys: [...keys, key] })
    }
  },
}))
