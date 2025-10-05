'use client'
import FlowingMenu from "../FlowingMenu";
const demoItems = [
    { link: '/verify', text: 'Verify', image: 'https://picsum.photos/600/400?random=1' },
    { link: '/notes', text: 'Notes', image: 'https://www.wikihow.com/images/thumb/4/4b/Take-Better-Notes-Step-7-Version-3.jpg/v4-460px-Take-Better-Notes-Step-7-Version-3.jpg' },
    { link: '/', text: 'Flashcards', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRHQivPqRHA1RQy2ahkZoJplcWNkKlglf1XDA&s' },
    { link: '/files', text: 'Files', image: 'https://www.safestore.co.uk/getattachment/a966c3d7-edd7-4706-9fe9-34c2e38e86cf/howtorganizeofficefilesarchives.jpg?lang=en-GB&ext=.jpg&width=960&resizemode=force' },
    { link: '/home/about-us', text: 'About Us', image: 'https://d1hdtc0tbqeghx.cloudfront.net/wp-content/uploads/2024/03/01115727/Best-About-Us-Page-Examples.jpg' },
  ];
  
  export function Sections() {
    return (
        <>
        <div className="text-center py-6">
        <h2 className="text-4xl md:text-6xl font-bold leading-tight">
            <span className="inline-block bg-black text-white px-4 py-2 rounded-lg">Millions</span> of Sections
        </h2>
        </div>
        <FlowingMenu items={demoItems} />
        </>
    );
}