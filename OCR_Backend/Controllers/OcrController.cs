using Microsoft.AspNetCore.Mvc;

namespace OCR_Backend.Controllers
{
    [ApiController]
    [Route("api/ocr")]
    public class OcrController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        public OcrController(IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        [HttpPost("read")]
        public async Task<IActionResult> Read(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                    return BadRequest(new { message = "No file uploaded." });

                var pythonBaseUrl = _configuration["PythonOcrService:BaseUrl"] ?? "http://127.0.0.1:8000";

                using var client = _httpClientFactory.CreateClient();
                using var multipartContent = new MultipartFormDataContent();
                using var fileStream = file.OpenReadStream();
                using var streamContent = new StreamContent(fileStream);

                streamContent.Headers.ContentType =
                    new System.Net.Http.Headers.MediaTypeHeaderValue(
                        string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType
                    );

                multipartContent.Add(streamContent, "file", file.FileName);
                try
                {
                    var response = await client.PostAsync($"{pythonBaseUrl}/ocr", multipartContent);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorBody = await response.Content.ReadAsStringAsync();
                        return StatusCode((int)response.StatusCode, new { message = errorBody });
                    }

                    var result = await response.Content.ReadAsStringAsync();
                    return Content(result, "application/json");
                }
                catch (Exception ex)
                {
                    return StatusCode(500, new { message = "An error occurred while processing the request.", details = ex.Message });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while processing the request.", details = ex.Message });
            }
        }
}
}
