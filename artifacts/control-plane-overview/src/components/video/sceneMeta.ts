export interface SceneDetails {
  title: string;
  filePath: string;
}

export const SCENE_DETAILS: Record<string, SceneDetails> = {
  hook: { title: 'Hook', filePath: 'src/components/video/video_scenes/Scene1.tsx' },
  knowledge: { title: 'Knowledge', filePath: 'src/components/video/video_scenes/Scene2.tsx' },
  catalogue: { title: 'Catalogue', filePath: 'src/components/video/video_scenes/Scene3.tsx' },
  builder: { title: 'Guided builder', filePath: 'src/components/video/video_scenes/Scene4.tsx' },
  languages: { title: 'Languages', filePath: 'src/components/video/video_scenes/Scene5.tsx' },
  package: { title: 'Package', filePath: 'src/components/video/video_scenes/Scene6.tsx' },
  finale: { title: 'Finale', filePath: 'src/components/video/video_scenes/Scene7.tsx' },
};
