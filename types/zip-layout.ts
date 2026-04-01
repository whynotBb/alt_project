export type ZipLayoutReport = {
  contentRootRelativePosix: string;
  htmlNextToContentRoot: number;
  htmlInSubfolders: number;
  imagesNextToContentRoot: number;
  imagesUnderImagesFolder: number;
  imagesInOtherFolders: number;
  localImgRefs: number;
  localImgResolved: number;
  localImgMissing: number;
};
