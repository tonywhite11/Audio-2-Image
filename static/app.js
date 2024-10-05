document.addEventListener('DOMContentLoaded', () => {
    const micButton = document.getElementById('micButton');
    const promptTextarea = document.getElementById('prompt');
    const generateForm = document.getElementById('generateForm');
    const imageContainer = document.getElementById('imageContainer');
    const spinner = document.getElementById('spinner');
    const refineToggle = document.getElementById('refineToggle');
    const imageCountSelect = document.getElementById('imageCount');

    let recognition;


    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            promptTextarea.value = transcript;
            processPrompt(transcript);
        };

        recognition.onend = () => {
            micButton.classList.remove('listening');
            micButton.querySelector('i').classList.remove('fa-stop');
            micButton.querySelector('i').classList.add('fa-microphone');
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
        };

        micButton.addEventListener('click', () => {
            if (micButton.classList.contains('listening')) {
                recognition.stop();
            } else {
                recognition.start();
                micButton.classList.add('listening');
                micButton.querySelector('i').classList.remove('fa-microphone');
                micButton.querySelector('i').classList.add('fa-stop');
            }
        });
    } else {
        micButton.style.display = 'none';
        console.warn('Speech recognition not supported in this browser');
    }

    async function processPrompt(prompt) {
        try {
            spinner.classList.remove('hidden');
            imageContainer.classList.add('hidden');
            imageContainer.innerHTML = ''; // Clear previous images

            let finalPrompt = prompt;
            const imageCount = parseInt(imageCountSelect.value);

            if (refineToggle.checked) {
                // Step 1: Refine the prompt
                const refineResponse = await fetch('/refine_prompt', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        'prompt': prompt,
                        'n': 1
                    })
                });

                if (!refineResponse.ok) {
                    throw new Error('Failed to refine prompt');
                }

                const refineData = await refineResponse.json();
                finalPrompt = refineData.refined_prompts[0];

                // Update the textarea with the refined prompt
                promptTextarea.value = finalPrompt;
            }

            // Step 2: Generate the images
            const generateResponse = await fetch('/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    'prompt': finalPrompt,
                    'n': imageCount
                })
            });

            if (!generateResponse.ok) {
                throw new Error('Failed to generate image');
            }

            const generateData = await generateResponse.json();
            const image_urls = generateData.image_urls;

            // Update the imageContainer class based on the number of images
            if (image_urls.length === 1) {
                imageContainer.className = 'mt-8 flex justify-center';
            } else {
                imageContainer.className = 'mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4';
            }

            image_urls.forEach((url, index) => {
                const imageWrapper = document.createElement('div');
                imageWrapper.className = 'relative';

                const imgElement = document.createElement('img');
                imgElement.src = url;
                imgElement.alt = 'Generated Image';
                imgElement.className = 'max-w-full h-auto rounded-lg shadow-lg';

                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'absolute top-2 right-2 flex gap-2';

                const downloadButton = document.createElement('button');
                downloadButton.innerHTML = '<i class="fas fa-download"></i>';
                downloadButton.className = 'btn btn-circle btn-sm btn-primary';
                downloadButton.addEventListener('click', () => downloadImage(url, `generated_image_${index + 1}.png`));

                buttonContainer.appendChild(downloadButton);

                imageWrapper.appendChild(imgElement);
                imageWrapper.appendChild(buttonContainer);
                imageContainer.appendChild(imageWrapper);
            });

            spinner.classList.add('hidden');
            imageContainer.classList.remove('hidden');
        } catch (error) {
            console.error('Error:', error);
            spinner.classList.add('hidden');
            alert('An error occurred. Please try again.');
        }
    }

    async function downloadImage(url, filename) {
        try {
            const response = await fetch(`/proxy_image?url=${encodeURIComponent(url)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch image');
            }
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            link.click();

            URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Error downloading image:', error);
            alert('Failed to download image. Please try again.');
        }
    }

    // Add event listener for manual form submission
    generateForm.addEventListener('submit', (e) => {
        e.preventDefault();
        processPrompt(promptTextarea.value);
    });

    // Add event listener for Enter key press in textarea
    promptTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent default behavior (new line)
            processPrompt(promptTextarea.value);
        }
    });
});

console.log("Image Generator app loaded");