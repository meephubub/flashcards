declare namespace JSX {
  interface IntrinsicElements {
    'langflow-chat': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
      window_title?: string;
      flow_id?: string;
      host_url?: string;
      // You can add other specific props for langflow-chat here if needed
    }, HTMLElement>;
  }
}
