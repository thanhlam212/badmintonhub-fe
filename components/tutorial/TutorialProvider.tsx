"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TutorialStep } from "./tutorial-steps";

type TutorialContextValue = {
  tutorialId: string;
  steps: TutorialStep[];
  currentStep: number;
  isActive: boolean;
  isPromptOpen: boolean;
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  restartTutorial: () => void;
  closePrompt: () => void;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

type TutorialProviderProps = {
  tutorialId: string;
  steps: TutorialStep[];
  children: ReactNode;
  storageKey?: string;
};

export function TutorialProvider({
  tutorialId,
  steps,
  children,
  storageKey,
}: TutorialProviderProps) {
  const seenKey = storageKey ?? `tutorial_seen_${tutorialId}`;
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(seenKey, "1");
    } catch {
      // localStorage can be blocked in some browser modes.
    }
  }, [seenKey]);

  useEffect(() => {
    try {
      if (!localStorage.getItem(seenKey)) {
        const timer = window.setTimeout(() => setIsPromptOpen(true), 700);
        return () => window.clearTimeout(timer);
      }
    } catch {
      setIsPromptOpen(true);
    }
  }, [seenKey]);

  const startTutorial = useCallback(() => {
    setCurrentStep(0);
    setIsPromptOpen(false);
    setIsActive(true);
  }, []);

  const skipTutorial = useCallback(() => {
    markSeen();
    setIsActive(false);
    setIsPromptOpen(false);
  }, [markSeen]);

  const nextStep = useCallback(() => {
    setCurrentStep((step) => {
      if (step >= steps.length - 1) {
        markSeen();
        setIsActive(false);
        return step;
      }
      return step + 1;
    });
  }, [markSeen, steps.length]);

  const prevStep = useCallback(() => {
    setCurrentStep((step) => Math.max(0, step - 1));
  }, []);

  const restartTutorial = useCallback(() => {
    setCurrentStep(0);
    setIsPromptOpen(false);
    setIsActive(true);
  }, []);

  const closePrompt = useCallback(() => {
    markSeen();
    setIsPromptOpen(false);
  }, [markSeen]);

  const value = useMemo<TutorialContextValue>(
    () => ({
      tutorialId,
      steps,
      currentStep,
      isActive,
      isPromptOpen,
      startTutorial,
      nextStep,
      prevStep,
      skipTutorial,
      restartTutorial,
      closePrompt,
    }),
    [
      tutorialId,
      steps,
      currentStep,
      isActive,
      isPromptOpen,
      startTutorial,
      nextStep,
      prevStep,
      skipTutorial,
      restartTutorial,
      closePrompt,
    ],
  );

  return (
    <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used inside TutorialProvider");
  }
  return context;
}
