import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useId,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface DropdownContextValue {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  close: () => void;
  menuId: string;
  triggerId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdown() {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error("DropdownMenu subcomponents must be wrapped in <DropdownMenu>");
  }
  return context;
}

export interface DropdownMenuProps {
  children: ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  children,
  className = "",
  open: controlledOpen,
  onOpenChange,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  const triggerId = `dropdown-trigger-${id}`;
  const menuId = `dropdown-menu-${id}`;

  const setIsOpen: React.Dispatch<React.SetStateAction<boolean>> = (valueOrFn) => {
    const nextVal = typeof valueOrFn === "function" ? valueOrFn(isOpen) : valueOrFn;
    if (!isControlled) {
      setUncontrolledOpen(nextVal);
    }
    onOpenChange?.(nextVal);
  };

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <DropdownContext.Provider
      value={{ isOpen, setIsOpen, close, menuId, triggerId, triggerRef }}
    >
      <div className={cn("relative inline-block text-left", className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
};

export interface DropdownMenuTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
  asChild?: boolean;
}

export const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps> = ({
  children,
  className = "",
  disabled = false,
  ...props
}) => {
  const { isOpen, setIsOpen, triggerId, menuId, triggerRef } = useDropdown();

  return (
    <button
      ref={triggerRef}
      id={triggerId}
      type="button"
      disabled={disabled}
      aria-haspopup="true"
      aria-expanded={isOpen}
      aria-controls={isOpen ? menuId : undefined}
      onClick={() => setIsOpen((prev) => !prev)}
      className={cn(
        "inline-flex items-center justify-between gap-1.5 rounded-lg border border-outline-variant bg-surface-container px-3 py-1.5 text-xs font-code-sm text-on-surface hover:bg-surface-container-high transition-colors focus:outline-none focus:ring-1 focus:ring-primary-container cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export interface DropdownMenuContentProps {
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}

export const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({
  children,
  className = "",
  align = "right",
}) => {
  const { isOpen, close, menuId, triggerId } = useDropdown();
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-labelledby={triggerId}
      className={cn(
        "absolute z-50 mt-1 min-w-[180px] origin-top-right rounded-lg border border-outline-variant bg-surface-container p-1 shadow-lg backdrop-blur-sm animate-in fade-in-0 zoom-in-95",
        align === "right" ? "right-0" : "left-0",
        className
      )}
    >
      {children}
    </div>
  );
};

export interface DropdownMenuItemProps {
  children: ReactNode;
  onSelect?: () => void;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: string;
}

export const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({
  children,
  onSelect,
  selected = false,
  disabled = false,
  className = "",
  icon,
}) => {
  const { close } = useDropdown();

  const handleSelect = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (disabled) return;
    e.stopPropagation();
    onSelect?.();
    close();
  };

  return (
    <button
      role="menuitem"
      type="button"
      disabled={disabled}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect(e);
        }
      }}
      className={cn(
        "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-code-sm rounded-md transition-colors text-left cursor-pointer outline-none select-none",
        selected
          ? "bg-surface-container-highest text-primary-container font-semibold"
          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="material-symbols-outlined text-[15px]">{icon}</span>}
        <span>{children}</span>
      </div>
      {selected && (
        <span className="material-symbols-outlined text-[15px] text-primary-container">
          check
        </span>
      )}
    </button>
  );
};

export interface DropdownOption<T extends string = string> {
  id: T;
  label: string;
  description?: string;
  icon?: string;
}

export interface SelectDropdownProps<T extends string = string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  labelPrefix?: string;
  className?: string;
  ariaLabel?: string;
}

export function SelectDropdown<T extends string = string>({
  value,
  options,
  onChange,
  labelPrefix,
  className = "",
  ariaLabel,
}: SelectDropdownProps<T>) {
  const selectedOption = options.find((opt) => opt.id === value) || options[0];

  return (
    <DropdownMenu className={className}>
      <DropdownMenuTrigger
        className="font-code-sm text-code-sm"
        aria-label={ariaLabel || (labelPrefix ? `${labelPrefix} ${selectedOption?.label}` : selectedOption?.label)}
      >
        <span className="flex items-center gap-1 text-outline">
          {labelPrefix && <span>{labelPrefix}</span>}
          <span className="text-on-surface font-medium">{selectedOption?.label}</span>
        </span>
        <span className="material-symbols-outlined text-[16px] text-outline">
          expand_more
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="right">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.id}
            selected={option.id === value}
            icon={option.icon}
            onSelect={() => onChange(option.id)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
