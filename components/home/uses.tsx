import FallingText from '../FallingText';
import ScrollVelocity from '../ScrollVelocity';

export function Uses() {
return (
<div className="relative h-screen overflow-hidden">
  <div className="absolute top-4 left-0 right-0 z-10">
    <ScrollVelocity
      texts={['Millions Of Uses', 'Thousands Of Functions']}
      velocity={100}
      className="custom-scroll-text"
    />
  </div>
  <div className="absolute bottom-0 left-0 right-0 h-3/4 flex justify-center items-center">
    <div className="w-full max-w-4xl text-center">
      <FallingText
        text={`React Bits is a library of animated and interactive React components designed to streamline UI development and simplify your workflow.`}
        trigger="hover"
        backgroundColor="transparent"
        wireframes={false}
        gravity={0.56}
        fontSize="2.5em"
      />
    </div>
  </div>
</div>
)
}
