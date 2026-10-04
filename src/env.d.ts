// These presentational HTML attributes are retained for visual parity with the
// original site. Browsers still support them; new components should use CSS.
declare namespace astroHTML.JSX {
  interface TdHTMLAttributes { width?: string | number }
  interface ImgHTMLAttributes {
    align?: string;
    vspace?: string | number;
    hspace?: string | number;
    border?: string | number;
  }
  interface InputHTMLAttributes { border?: string | number }
  interface HTMLAttributes { clear?: string }
  // Able Player reads the legacy audio width attribute when building its UI.
  interface MediaHTMLAttributes { width?: string | number }
}
