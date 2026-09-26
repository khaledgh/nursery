import { Modal as HeroModal, ModalContent, ModalHeader, ModalBody } from "@heroui/react";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ open, title, onClose, children, wide }: ModalProps) {
  return (
    <HeroModal
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      size={wide ? "2xl" : "md"}
      placement="center"
      backdrop="blur"
      scrollBehavior="inside"
      classNames={{
        wrapper: "z-[9999] items-center justify-center p-4 sm:p-6",
        backdrop: "z-[9998] bg-slate-900/50 backdrop-blur-sm",
        base: `my-auto border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl rounded-2xl w-full ${
          wide ? "max-w-2xl" : "max-w-md sm:max-w-lg"
        } overflow-hidden`,
        header: "border-b border-slate-100 dark:border-slate-800 text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 py-3 px-5",
        body: "p-4 sm:p-5 max-h-[75vh] overflow-y-auto",
        closeButton: "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-lg p-1.5 top-2.5 right-2.5",
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader>{title}</ModalHeader>
            <ModalBody>{children}</ModalBody>
          </>
        )}
      </ModalContent>
    </HeroModal>
  );
}

