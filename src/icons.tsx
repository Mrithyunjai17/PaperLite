import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

const Icon = ({ children, ...props }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);

export const Icons = {
  file: (p: Props) => <Icon {...p}><path d="M7 3.5h7l4 4V20H7z"/><path d="M14 3.5V8h4"/></Icon>,
  open: (p: Props) => <Icon {...p}><path d="M3.5 18.5 6 9h14.5l-2.7 9.5z"/><path d="M5.2 9V5.5h6l2 2H18V9"/></Icon>,
  save: (p: Props) => <Icon {...p}><path d="M5 3.5h12l2 2V20H5z"/><path d="M8 3.5v6h8v-6M8 20v-6h8v6"/></Icon>,
  search: (p: Props) => <Icon {...p}><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/></Icon>,
  cursor: (p: Props) => <Icon {...p}><path d="m5 3 13 9-6 1.5L9 20z"/></Icon>,
  pen: (p: Props) => <Icon {...p}><path d="m4 20 4.2-1 10.6-10.6-3.2-3.2L5 15.8zM13.5 7.3l3.2 3.2"/></Icon>,
  highlight: (p: Props) => <Icon {...p}><path d="m6 14 8-9 4 3.5-8 9zM4 20h13M6 14l4 3.5"/></Icon>,
  text: (p: Props) => <Icon {...p}><path d="M5 5h14M12 5v14M8.5 19h7"/></Icon>,
  eraser: (p: Props) => <Icon {...p}><path d="m4.5 14.5 7.8-9a2 2 0 0 1 2.8-.2l3.6 3.2a2 2 0 0 1 .2 2.8L12 19H7zM12 19h8"/></Icon>,
  undo: (p: Props) => <Icon {...p}><path d="m9 7-5 5 5 5M5 12h8a6 6 0 0 1 6 6"/></Icon>,
  redo: (p: Props) => <Icon {...p}><path d="m15 7 5 5-5 5M19 12h-8a6 6 0 0 0-6 6"/></Icon>,
  chevronLeft: (p: Props) => <Icon {...p}><path d="m14.5 18-6-6 6-6"/></Icon>,
  chevronRight: (p: Props) => <Icon {...p}><path d="m9.5 18 6-6-6-6"/></Icon>,
  chevronDown: (p: Props) => <Icon {...p}><path d="m7 9.5 5 5 5-5"/></Icon>,
  close: (p: Props) => <Icon {...p}><path d="m6 6 12 12M18 6 6 18"/></Icon>,
  plus: (p: Props) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  minus: (p: Props) => <Icon {...p}><path d="M5 12h14"/></Icon>,
  settings: (p: Props) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></Icon>,
  more: (p: Props) => <Icon {...p}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></Icon>,
  fit: (p: Props) => <Icon {...p}><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></Icon>,
  rotate: (p: Props) => <Icon {...p}><path d="M20 8V3l-2 2a9 9 0 1 0 2.2 9"/><path d="M20 3h-5"/></Icon>,
  check: (p: Props) => <Icon {...p}><path d="m5 12 4 4L19 6"/></Icon>,
};
