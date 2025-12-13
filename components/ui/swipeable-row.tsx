"use client";

import { motion, useAnimation, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { Trash2, Pencil } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SwipeableRowProps {
    children: ReactNode;
    onEdit?: () => void;
    onDelete?: () => void;
    className?: string; // For additional styling on the container
}

export function SwipeableRow({ children, onEdit, onDelete, className }: SwipeableRowProps) {
    const controls = useAnimation();
    const x = useMotionValue(0);
    // Hide actions until dragged at least 10px to the left
    const opacity = useTransform(x, [-5, -40], [0, 1]);
    const zIndex = useTransform(x, [-1, 0], [10, -1]); // Push to back when not active

    const handleDragEnd = async (event: any, info: PanInfo) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;

        // Threshold to trigger "open" state
        if (offset < -64 || (offset < -50 && velocity < -500)) {
            await controls.start({ x: -128, transition: { type: "spring", stiffness: 500, damping: 30 } });
        } else {
            await controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
        }
    };

    const resetPosition = () => {
        controls.start({ x: 0 });
    };

    return (
        <div className={cn("relative group overflow-hidden bg-background rounded-xl border-none", className)}>
            {/* Background Actions Layer (Revealed on Swipe) */}
            <motion.div
                className="absolute inset-y-0 right-0 w-32 flex z-0"
                style={{ opacity }}
            >
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        resetPosition();
                        onEdit?.();
                    }}
                    className="w-16 h-full bg-blue-600 flex items-center justify-center text-white transition-colors hover:bg-blue-700"
                >
                    <Pencil size={18} />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        resetPosition();
                        onDelete?.();
                    }}
                    className="w-16 h-full bg-red-600 flex items-center justify-center text-white transition-colors hover:bg-red-700"
                >
                    <Trash2 size={18} />
                </button>
            </motion.div>

            {/* Foreground Content Layer */}
            <motion.div
                animate={controls}
                style={{ x, touchAction: "pan-y" }}
                drag="x"
                dragConstraints={{ left: -128, right: 0 }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                className="relative z-10 bg-card rounded-xl border border-white/5 shadow-sm hover:bg-card transition-colors"
            >
                {/* 
                 * NOTE: We rely on the child Card having a transparent background 
                 * or managing its own, but to prevent "bleed through" on hover, 
                 * this container must be opaque `bg-card`. 
                 * Previous `hover:bg-card/80` caused transparency.
                 */}
                {children}
            </motion.div>
        </div>
    );
}
