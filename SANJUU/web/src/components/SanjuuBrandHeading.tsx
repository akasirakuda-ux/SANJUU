type Props = {
  as?: 'h1' | 'h2';
};

/** らくだ珈琲のことば探し系と同フォント（M PLUS Rounded）、同サイズ（text-3xl 相当） */
export default function SanjuuBrandHeading({ as: Tag = 'h1' }: Props) {
  return <Tag className="sanjuuBrand">【30SANJUU】</Tag>;
}
