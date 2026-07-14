export interface FragmentMeta {
  section: string;      // default: 'instructions'
  priority: number;     // default: 0; higher renders first within a section
  exclusive: boolean;   // default: false
}

export interface ModuleFragment {
  moduleName: string;
  content: string;
  meta: FragmentMeta;
}

export interface ComposedPrompt {
  sections: Array<{ name: string; content: string }>;
  markdown: string;
}
