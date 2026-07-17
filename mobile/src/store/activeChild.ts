import { create } from "zustand";
import type { Child } from "../api/types";

// The /children list returns full Child rows; the active selection carries
// everything Home needs (avatar, dob, classroom, presence).
export type ChildSummary = Child;

interface ActiveChildState {
  child: ChildSummary | null;
  setChild: (child: ChildSummary | null) => void;
}

// A parent with several children picks the active one; every child-scoped
// query keys off this selection.
export const useActiveChild = create<ActiveChildState>((set) => ({
  child: null,
  setChild: (child) => set({ child }),
}));
