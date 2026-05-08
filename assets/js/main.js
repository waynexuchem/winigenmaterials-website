const toggle=document.querySelector('.mobile-toggle');
const menu=document.querySelector('.mobile-menu');
if(toggle&&menu){toggle.addEventListener('click',()=>menu.classList.toggle('open'));}

// ===============================
// Formspree Integration
// ===============================

document.addEventListener('DOMContentLoaded', () => {

  const forms = document.querySelectorAll('form[data-formspree], form.js-formspree-form');

  forms.forEach(form => {

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('button[type="submit"]');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Sending...';
      }

      const formData = new FormData(form);

      try {

        const response = await fetch('https://formspree.io/f/mlgzldpy', {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {

          alert('Thank you! Your request has been submitted.');

          form.reset();

        } else {

          alert('Oops! Something went wrong. Please try again.');

        }

      } catch (error) {

        alert('Network error. Please try again later.');

      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = submitBtn.dataset.originalText || 'Submit';
      }

    });

  });

});