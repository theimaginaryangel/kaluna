"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export function WordmarkLink() {
  const [hovered, setHovered] = React.useState(false);

  const text = "KALUNA";

  return (
    <Link
      href="/"
      className="relative inline-flex items-center gap-2 w-fit ring-pink-focus rounded-md p-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.span
        className="font-mono text-xl font-extrabold tracking-tight flex"
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: { staggerChildren: 0.05 },
          },
        }}
      >
        {text.split("").map((char, index) => (
          <motion.span
            key={index}
            variants={{
              hidden: { opacity: 0, y: -10 },
              visible: { opacity: 1, y: 0 },
            }}
            animate={
              hovered ? { y: -3, color: "#FF2D87" } : { y: 0, color: "inherit" }
            }
            transition={{ type: "spring", stiffness: 300, damping: 10 }}
          >
            {char}
          </motion.span>
        ))}
      </motion.span>
      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        EVENTS
      </span>
    </Link>
  );
}
