"use client";

// Inspired by react-hot-toast library
import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 5000; // Adjusted TOAST_REMOVE_DELAY

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

// Helper function to clear a specific timeout
const clearToastTimeout = (toastId: string) => {
  const timeout = toastTimeouts.get(toastId);
  if (timeout) {
    clearTimeout(timeout);
    toastTimeouts.delete(toastId);
  }
};

// Helper function to clear all timeouts
const clearAllToastTimeouts = () => {
  toastTimeouts.forEach((timeout) => clearTimeout(timeout));
  toastTimeouts.clear();
};

const addToRemoveQueue = (toastId: string) => {
  // If a timeout already exists for this toastId (e.g., from a previous dismiss action that was superseded),
  // clear it before setting a new one. This can happen if onOpenChange is called multiple times rapidly.
  clearToastTimeout(toastId);

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId); // Ensure it's deleted before dispatching REMOVE_TOAST
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      // Clear timeout if a toast with the same ID is being re-added
      // This is handled in the `toast` function before dispatching ADD_TOAST
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;
      // Side effect of calling addToRemoveQueue is removed from the reducer.
      // Clearing timeouts is a state management concern related to toast lifecycle.
      if (toastId) {
        clearToastTimeout(toastId); // Clear specific timeout
      } else {
        clearAllToastTimeouts(); // Clear all timeouts if dismissing all
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false, // Only mark as not open
              }
            : t,
        ),
      };
    }
    case "REMOVE_TOAST": {
      const { toastId } = action;
      if (toastId) {
        clearToastTimeout(toastId); // Clear specific timeout
      } else {
        clearAllToastTimeouts(); // Clear all timeouts if removing all
      }

      if (toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== toastId),
      };
    }
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });

  // Original dismiss function, now primarily for external calls or if onOpenChange doesn't cover all dismiss cases.
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  // Before adding a new toast, clear any existing timeout for this ID.
  // This handles cases where a toast might be rapidly re-added or updated.
  clearToastTimeout(id);

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) {
          // When toast is closed (e.g., by user action or auto-hide from component),
          // schedule its removal from the state.
          addToRemoveQueue(id);
          // We can still call dismiss to ensure the state's `open` flag is set to false,
          // though addToRemoveQueue will eventually remove it.
          // This also handles any other logic that might be in dismiss (currently none beyond setting open:false).
          dispatch({ type: "DISMISS_TOAST", toastId: id });
        }
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    // Expose a general dismiss function that can take an ID or dismiss all
    dismiss: (toastId?: string) =>
      dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { useToast, toast };
