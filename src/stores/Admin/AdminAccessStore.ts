import {create} from 'zustand';

type AdminAccessState = {
  unlockVisible: boolean;
  setUnlockVisible: (visible: boolean) => void;
};

export const useAdminAccessStore = create<AdminAccessState>(set => ({
  unlockVisible: false,
  setUnlockVisible: unlockVisible => set({unlockVisible}),
}));
