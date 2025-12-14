import { toast as sonnerToast } from "sonner";

// Global Shim to silence success messages as per UX Requirements
export const toast = {
    ...sonnerToast,
    // NO-OP for success
    success: (message: string | React.ReactNode, data?: any) => {
        // Optimistic UI means we don't need to say "Success"
        // console.log("Silenced success toast:", message); 
        return;
    },
    // Keep Error visible
    error: sonnerToast.error,
    // Keep others if needed, or default to sonnerToast
    message: sonnerToast.message,
    warning: sonnerToast.warning,
    info: sonnerToast.info,
    dismiss: sonnerToast.dismiss,
    loading: sonnerToast.loading,
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
};
