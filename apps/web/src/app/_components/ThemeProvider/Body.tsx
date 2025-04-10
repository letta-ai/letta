interface BodyProps {
  children: React.ReactNode;
}

export async function Body(props: BodyProps) {
  const { children } = props;

  return (
    <body>
      <div className="min-h-[100dvh]">{children}</div>
    </body>
  );
}
