export interface SceneDetails { title: string; filePath: string }
export const SCENE_DETAILS: Record<string, SceneDetails> = {
  intro: { title: 'Why Control Plane', filePath: 'src/components/video/video_scenes/Intro.tsx' },
  overview: { title: 'Overview', filePath: 'src/components/video/video_scenes/Pages.tsx' },
  knowledge: { title: 'Knowledge', filePath: 'src/components/video/video_scenes/Pages.tsx' },
  catalogue: { title: 'Catalogue', filePath: 'src/components/video/video_scenes/Pages.tsx' },
  builder: { title: 'Guided builder', filePath: 'src/components/video/video_scenes/Pages.tsx' },
  mcp: { title: 'MCP components', filePath: 'src/components/video/video_scenes/Pages.tsx' },
  agents: { title: 'Agents', filePath: 'src/components/video/video_scenes/Pages.tsx' },
  outro: { title: 'Review & lockup', filePath: 'src/components/video/video_scenes/Outro.tsx' },
};
